const { addScanRecord, getAllScanRecords } = require("../data/scanStore");
const { mapRecordToDynamoItem } = require("../utils/dynamoMapper");
const { formatGitHubComment } = require("../utils/githubCommentFormatter");
const { uploadReportToS3 } = require("./s3Service");
const {
  saveToDynamo,
  getScansByRepoFromDynamo,
  getScanByRunIdFromDynamo
} = require("./dynamoService");


function buildScanResponse(payload) {
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
    riskScore: payload.summary.riskScore,
    severityCounts: payload.summary.severityCounts,
    totalFindings: payload.summary.totalFindings,
    topFindings: payload.topFindings || [],
    reportFormat: payload.report.format,
    reportContent: payload.report.content
  };
}

async function saveScanRecord(payload) {
  const record = buildScanResponse(payload);
  addScanRecord(record);
  try {
    const dynamoItem = {
    repo: record.repo,
    timestamp: record.timestamp,
    runId: record.runId,
    scanType: record.scanType,
    status: record.status,
    riskScore: record.riskScore,
    severityCounts: record.severityCounts,
    totalFindings: record.totalFindings,
    topFindings: record.topFindings,
    branch: record.branch,
    commitSha: record.commitSha,
    toolName: record.toolName,
    toolVersion: record.toolVersion,
    reportFormat: record.reportFormat,
    reportS3Key: `reports/${record.repo}/${record.scanType}/${record.runId}.json`
  };

    const s3Key = dynamoItem.reportS3Key;
    await uploadReportToS3(s3Key, record);
    console.log("S3 upload success:", s3Key);

    await saveToDynamo(dynamoItem);
    console.log("DynamoDB write success:", record.runId);
  } catch (error) {
    console.error("AWS persistence failed:", error);
  }
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

async function getScansByRepoLive(owner, repo) {
  const fullName = `${owner}/${repo}`;
  const items = await getScansByRepoFromDynamo(fullName);

  return items.map((item) => ({
    repo: item.repo,
    timestamp: item.timestamp,
    runId: item.runId,
    scanType: item.scanType,
    status: item.status,
    riskScore: item.riskScore,
    severityCounts: item.severityCounts,
    totalFindings: item.totalFindings,
    topFindings: item.topFindings,
    branch: item.branch,
    commitSha: item.commitSha,
    toolName: item.toolName,
    toolVersion: item.toolVersion,
    reportFormat: item.reportFormat,
    reportS3Key: item.reportS3Key
  }));
}

async function getLatestScanByRepoLive(owner, repo) {
  const scans = await getScansByRepoLive(owner, repo);

  if (scans.length === 0) {
    return null;
  }

  return scans[0];
}

async function getScanByRunIdLive(runId) {
  const item = await getScanByRunIdFromDynamo(runId);

  if (!item) {
    return null;
  }

  return {
    repo: item.repo,
    timestamp: item.timestamp,
    runId: item.runId,
    scanType: item.scanType,
    status: item.status,
    riskScore: item.riskScore,
    severityCounts: item.severityCounts,
    totalFindings: item.totalFindings,
    topFindings: item.topFindings,
    branch: item.branch,
    commitSha: item.commitSha,
    toolName: item.toolName,
    toolVersion: item.toolVersion,
    reportFormat: item.reportFormat,
    reportS3Key: item.reportS3Key
  };
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
  getScansByRepoLive,
  getLatestScanByRepoLive,
  buildDashboardSummaryLive,
  getScanByRunIdLive
};