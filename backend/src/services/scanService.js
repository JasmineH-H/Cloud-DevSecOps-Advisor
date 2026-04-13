const { addScanRecord, getAllScanRecords } = require("../data/scanStore");
const { mapRecordToDynamoItem } = require("../utils/dynamoMapper");
const { formatGitHubComment } = require("../utils/githubCommentFormatter");
const { uploadReportToS3, listReportObjects, getJsonObject } = require("./s3Service");
const {
  saveToDynamo,
  getScansByRepoFromDynamo,
  getScanByRunIdFromDynamo,
  getRepoOptionsFromDynamo
} = require("./dynamoService");


function buildScanResponse(payload) {
  // Returns the FULL normalized record that will be stored in S3
  // Includes reportContent with the complete payload/report data
  return {
    source: payload.source,
    scanType: payload.scanType,
    repo: payload.repo.fullName,
    owner: payload.repo.owner,
    name: payload.repo.name,
    runId: payload.run.runId,
    status: payload.run.status,
    timestamp: payload.run.timestamp,
    branch: payload.run.branch,
    commitSha: payload.run.commitSha,
    toolName: payload.run.toolName,
    toolVersion: payload.run.toolVersion,
    rawRiskScore: payload.summary.rawRiskScore,
    riskScore: payload.summary.riskScore,
    severityCounts: payload.summary.severityCounts,
    totalFindings: payload.summary.totalFindings,
    topFindings: payload.topFindings || [],
    rawReportS3Key: payload.rawReportS3Key || null,
    reportFormat: payload.report.format,
    reportContent: payload.report.content
  };
}

async function saveScanRecord(payload) {
  const record = buildScanResponse(payload);
  const s3Key = `reports/${record.repo}/${String(record.scanType).toLowerCase()}/${record.runId}.json`;

  // Debug: Log before starting
  console.log("[saveScanRecord] Starting ingest:", {
    repo: record.repo,
    runId: record.runId,
    scanType: record.scanType
  });

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: DynamoDB is PRIMARY - write summary item first
  // ═══════════════════════════════════════════════════════════════════
  // DynamoDB failure = ingest fails; DynamoDB success = ingest succeeds
  try {
    console.log("[saveScanRecord] Starting DynamoDB write for runId:", record.runId);
    // Build summary item for DynamoDB - excludes reportContent
    const dynamoItem = {
      repo: record.repo,
      timestamp: record.timestamp,
      runId: record.runId,
      scanType: record.scanType,
      status: record.status,
      rawRiskScore: record.rawRiskScore,
      riskScore: record.riskScore,
      severityCounts: record.severityCounts,
      totalFindings: record.totalFindings,
      topFindings: record.topFindings,
      branch: record.branch,
      commitSha: record.commitSha,
      toolName: record.toolName,
      toolVersion: record.toolVersion,
      reportFormat: record.reportFormat,
      reportS3Key: s3Key,
      rawReportS3Key: record.rawReportS3Key || null
    };

    await saveToDynamo(dynamoItem);
    console.log("[saveScanRecord] DynamoDB write success:", record.runId);
  } catch (error) {
    console.error("[saveScanRecord] DynamoDB write FAILED:", { message: error.message, code: error.code });
    throw new Error(`DYNAMODB_WRITE_FAILED: ${error.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Add to in-memory store for local queries
  // ═══════════════════════════════════════════════════════════════════
  addScanRecord(record);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: S3 is OPTIONAL - upload full normalized record
  // ═══════════════════════════════════════════════════════════════════
  // S3 failure = only warn, do NOT fail the ingest
  try {
    console.log("[saveScanRecord] Attempting S3 upload to key:", s3Key);
    await uploadReportToS3(s3Key, record);
    console.log("[saveScanRecord] S3 upload success:", s3Key);
  } catch (error) {
    console.warn(`[saveScanRecord] S3 upload failed (optional): ${error.message}`);
  }

  // Return the full normalized record (with DynamoDB and optional S3)
  return record;
}

function getScansByRepo(owner, repo) {
  const fullName = `${owner}/${repo}`;
  const scans = getAllScanRecords().filter((record) => record.repo === fullName);

  scans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return scans;
}

function getLatestScanByRepo(owner, repo) {
  const scans = getScansByRepo(owner, repo);

  if (scans.length === 0) {
    return null;
  }

  return scans[0];
}

function getScanByRunId(runId) {
  const records = getAllScanRecords();
  const foundRecord = records.find((record) => record.runId === runId);

  return foundRecord || null;
}

function getLatestScanByType(owner, repo, scanType) {
  const scans = getScansByRepo(owner, repo);
  const filteredScans = scans.filter((record) => record.scanType === scanType);

  if (filteredScans.length === 0) {
    return null;
  }

  return filteredScans[0];
}

function calculateOverallRiskScore(latestSast, latestPentest) {
  if (latestSast && latestPentest) {
    return Math.round(latestSast.riskScore * 0.4 + latestPentest.riskScore * 0.6);
  }

  if (latestSast) {
    return latestSast.riskScore;
  }

  if (latestPentest) {
    return latestPentest.riskScore;
  }

  return null;
}

function buildDashboardSummary(owner, repo) {
  const latestSast = getLatestScanByType(owner, repo, "SAST");
  const latestPentest = getLatestScanByType(owner, repo, "PENTEST");
  const overallRiskScore = calculateOverallRiskScore(latestSast, latestPentest);

  const prioritizedVulnerabilities = [];

  if (latestSast && Array.isArray(latestSast.topFindings)) {
    for (const finding of latestSast.topFindings) {
      prioritizedVulnerabilities.push({
        source: "SAST",
        ...finding
      });
    }
  }

  if (latestPentest && Array.isArray(latestPentest.topFindings)) {
    for (const finding of latestPentest.topFindings) {
      prioritizedVulnerabilities.push({
        source: "PENTEST",
        ...finding
      });
    }
  }

  const simulatedGitHubComment = latestSast
    ? formatGitHubComment(latestSast)
    : null;

  const severityOrder = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  prioritizedVulnerabilities.sort((a, b) => {
    const severityA = severityOrder[a.severity?.toLowerCase()] || 0;
    const severityB = severityOrder[b.severity?.toLowerCase()] || 0;
    return severityB - severityA;
  });

  return {
    repo: `${owner}/${repo}`,
    overallRiskScore,
    latestSast,
    latestPentest,
    prioritizedVulnerabilities,
    simulatedGitHubComment
  };
}

function getDynamoItemByRunId(runId) {
  const record = getScanByRunId(runId);

  if (!record) {
    return null;
  }

  return mapRecordToDynamoItem(record);
}

function getDynamoItemsByRepo(owner, repo) {
  const scans = getScansByRepo(owner, repo);
  return scans.map((record) => mapRecordToDynamoItem(record));
}

function getRepoOptions() {
  const records = getAllScanRecords();
  const ownerMap = new Map();

  for (const record of records) {
    if (!ownerMap.has(record.owner)) {
      ownerMap.set(record.owner, new Set());
    }

    ownerMap.get(record.owner).add(record.name);
  }

  const result = [];

  for (const [owner, repoSet] of ownerMap.entries()) {
    result.push({
      owner,
      repositories: Array.from(repoSet).sort()
    });
  }

  result.sort((a, b) => a.owner.localeCompare(b.owner));

  return result;
}

async function getRepoOptionsLive() {
  try {
    const allKeys = await listReportObjects("reports/");
    const ownerMap = new Map();

    for (const key of allKeys) {
      try {
        const record = await getJsonObject(key);
        
        if (!record) {
          continue;
        }

        let owner, repo;
        
        // Try to get owner and name from record directly
        if (record.owner && record.name) {
          owner = record.owner;
          repo = record.name;
        } else if (record.repo) {
          // Check if repo contains "/"
          if (record.repo.includes("/")) {
            const [ownerPart, repoPart] = record.repo.split("/");
            owner = ownerPart;
            repo = repoPart;
          } else {
            // Single repo name
            owner = "unknown";
            repo = record.repo;
          }
        } else {
          // Skip if we can't determine repo
          continue;
        }

        if (!ownerMap.has(owner)) {
          ownerMap.set(owner, new Set());
        }

        ownerMap.get(owner).add(repo);
      } catch (error) {
        console.error(`Error processing S3 object ${key}:`, error);
        continue;
      }
    }

    const result = [];

    for (const [owner, repoSet] of ownerMap.entries()) {
      result.push({
        owner,
        repositories: Array.from(repoSet).sort()
      });
    }

    result.sort((a, b) => a.owner.localeCompare(b.owner));

    return result;
  } catch (error) {
    console.error("Error getting repo options from S3:", error);
    return [];
  }
}

async function getScansByRepoLive(owner, repo) {
  try {
    const fullName = `${owner}/${repo}`;
    
    // Try both prefixes: full name and just repo name
    const prefix1 = `reports/${fullName}/`;
    const prefix2 = `reports/${repo}/`;
    
    const keys1 = await listReportObjects(prefix1);
    const keys2 = await listReportObjects(prefix2);
    const allKeys = [...new Set([...keys1, ...keys2])]; // Deduplicate

    const scans = [];

    for (const key of allKeys) {
      try {
        const jsonData = await getJsonObject(key);
        
        if (jsonData && jsonData.runId) {
          scans.push({
            repo: jsonData.repo || fullName,
            timestamp: jsonData.timestamp,
            runId: jsonData.runId,
            scanType: jsonData.scanType,
            status: jsonData.status,
            riskScore: jsonData.riskScore,
            severityCounts: jsonData.severityCounts,
            totalFindings: jsonData.totalFindings,
            topFindings: jsonData.topFindings || [],
            branch: jsonData.branch,
            commitSha: jsonData.commitSha,
            toolName: jsonData.toolName,
            toolVersion: jsonData.toolVersion,
            reportFormat: jsonData.reportFormat,
            rawReportS3Key: jsonData.rawReportS3Key || null,
            reportS3Key: key
          });
        }
      } catch (error) {
        console.error(`Error reading S3 object ${key}:`, error);
      }
    }

    // Sort by timestamp descending (newest first)
    scans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return scans;
  } catch (error) {
    console.error("Error getting scans by repo from S3:", error);
    return [];
  }
}


async function getLatestScanByRepoLive(owner, repo) {
  const scans = await getScansByRepoLive(owner, repo);

  if (scans.length === 0) {
    return null;
  }

  return scans[0];
}

async function getScanByRunIdLive(runId) {
  try {
    // List all report objects
    const allKeys = await listReportObjects("reports/");

    for (const key of allKeys) {
      try {
        const jsonData = await getJsonObject(key);
        
        if (jsonData && jsonData.runId === runId) {
          return {
            repo: jsonData.repo,
            timestamp: jsonData.timestamp,
            runId: jsonData.runId,
            scanType: jsonData.scanType,
            status: jsonData.status,
            riskScore: jsonData.riskScore,
            severityCounts: jsonData.severityCounts,
            totalFindings: jsonData.totalFindings,
            topFindings: jsonData.topFindings || [],
            branch: jsonData.branch,
            commitSha: jsonData.commitSha,
            toolName: jsonData.toolName,
            toolVersion: jsonData.toolVersion,
            reportFormat: jsonData.reportFormat,
            rawReportS3Key: jsonData.rawReportS3Key || null,
            reportS3Key: key
          };
        }
      } catch (error) {
        console.error(`Error reading S3 object ${key}:`, error);
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting scan by runId from S3:", error);
    return null;
  }
}


async function buildDashboardSummaryLive(owner, repo) {
  const scans = await getScansByRepoLive(owner, repo);

  const latestSast = scans.find((scan) => scan.scanType === "SAST") || null;
  const latestPentest = scans.find((scan) => scan.scanType === "PENTEST") || null;

  const overallRiskScore = calculateOverallRiskScore(latestSast, latestPentest);

  const prioritizedVulnerabilities = [];

  if (latestSast && Array.isArray(latestSast.topFindings)) {
    for (const finding of latestSast.topFindings) {
      prioritizedVulnerabilities.push({
        source: "SAST",
        ...finding
      });
    }
  }

  if (latestPentest && Array.isArray(latestPentest.topFindings)) {
    for (const finding of latestPentest.topFindings) {
      prioritizedVulnerabilities.push({
        source: "PENTEST",
        ...finding
      });
    }
  }

  const severityOrder = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  prioritizedVulnerabilities.sort((a, b) => {
    const severityA = severityOrder[a.severity?.toLowerCase()] || 0;
    const severityB = severityOrder[b.severity?.toLowerCase()] || 0;
    return severityB - severityA;
  });

  const simulatedGitHubComment = latestSast
    ? formatGitHubComment(latestSast)
    : null;

  return {
    repo: `${owner}/${repo}`,
    overallRiskScore,
    latestSast,
    latestPentest,
    prioritizedVulnerabilities,
    simulatedGitHubComment
  };
}

// PRIMARY functions: DynamoDB-first with optional S3 fallback
async function getRepoOptionsPrimary() {
  try {
    console.log("[getRepoOptionsPrimary] Reading from DynamoDB");
    const options = await getRepoOptionsFromDynamo();
    if (options && options.length > 0) {
      console.log("[getRepoOptionsPrimary] DynamoDB returned:", options.length, "owners");
      return options;
    }
  } catch (error) {
    console.warn("[getRepoOptionsPrimary] DynamoDB failed, falling back to S3:", error.message);
  }
  console.log("[getRepoOptionsPrimary] Falling back to S3");
  return getRepoOptionsLive();
}

async function getScansByRepoPrimary(owner, repo) {
  const fullName = `${owner}/${repo}`;
  try {
    console.log("[getScansByRepoPrimary] Reading from DynamoDB for:", fullName);
    const scans = await getScansByRepoFromDynamo(fullName);
    if (scans && scans.length > 0) {
      console.log("[getScansByRepoPrimary] DynamoDB returned:", scans.length, "scans");
      return scans;
    }
  } catch (error) {
    console.warn("[getScansByRepoPrimary] DynamoDB failed, falling back to S3:", error.message);
  }
  console.log("[getScansByRepoPrimary] Falling back to S3 for:", fullName);
  return getScansByRepoLive(owner, repo);
}

async function getLatestScanByRepoPrimary(owner, repo) {
  const scans = await getScansByRepoPrimary(owner, repo);
  return scans.length === 0 ? null : scans[0];
}

async function getScanByRunIdPrimary(runId) {
  try {
    console.log("[getScanByRunIdPrimary] Reading from DynamoDB for runId:", runId);
    const scan = await getScanByRunIdFromDynamo(runId);
    if (scan) {
      console.log("[getScanByRunIdPrimary] DynamoDB returned scan:", scan.runId);
      return scan;
    }
  } catch (error) {
    console.warn("[getScanByRunIdPrimary] DynamoDB failed, falling back to S3:", error.message);
  }
  console.log("[getScanByRunIdPrimary] Falling back to S3 for runId:", runId);
  return getScanByRunIdLive(runId);
}

async function buildDashboardSummaryPrimary(owner, repo) {
  const fullName = `${owner}/${repo}`;
  const scans = await getScansByRepoPrimary(owner, repo);
  const latestSast = scans.find((scan) => scan.scanType === "SAST") || null;
  const latestPentest = scans.find((scan) => scan.scanType === "PENTEST") || null;
  const overallRiskScore = calculateOverallRiskScore(latestSast, latestPentest);
  const prioritizedVulnerabilities = [];
  if (latestSast && Array.isArray(latestSast.topFindings)) {
    for (const finding of latestSast.topFindings) {
      prioritizedVulnerabilities.push({ source: "SAST", ...finding });
    }
  }
  if (latestPentest && Array.isArray(latestPentest.topFindings)) {
    for (const finding of latestPentest.topFindings) {
      prioritizedVulnerabilities.push({ source: "PENTEST", ...finding });
    }
  }
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  prioritizedVulnerabilities.sort((a, b) => {
    const severityA = severityOrder[a.severity?.toLowerCase()] || 0;
    const severityB = severityOrder[b.severity?.toLowerCase()] || 0;
    return severityB - severityA;
  });
  const simulatedGitHubComment = latestSast ? formatGitHubComment(latestSast) : null;
  return {
    repo: fullName,
    overallRiskScore,
    latestSast,
    latestPentest,
    prioritizedVulnerabilities,
    simulatedGitHubComment
  };
}

module.exports = {
  buildScanResponse,
  saveScanRecord,
  getScansByRepo,
  getLatestScanByRepo,
  getScanByRunId,
  getLatestScanByType,
  calculateOverallRiskScore,
  buildDashboardSummary,
  getDynamoItemByRunId,
  getDynamoItemsByRepo,
  getRepoOptions,
  getRepoOptionsLive,
  getScansByRepoLive,
  getLatestScanByRepoLive,
  buildDashboardSummaryLive,
  getScanByRunIdLive,
  getRepoOptionsPrimary,
  getScansByRepoPrimary,
  getLatestScanByRepoPrimary,
  getScanByRunIdPrimary,
  buildDashboardSummaryPrimary
};