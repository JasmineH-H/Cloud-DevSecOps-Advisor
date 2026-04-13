const {
  saveScanRecord,
  getRepoOptionsPrimary,
  getScansByRepoPrimary,
  getLatestScanByRepoPrimary,
  getScanByRunIdPrimary,
  buildDashboardSummaryPrimary,
  getDynamoItemsByRepo,
  getDynamoItemByRunId,
} = require("../services/scanService");
const { getDynamoClientStatus } = require("../services/dynamoService");
const { getS3ClientStatus } = require("../services/s3Service");

async function ingestSAST(req, res) {
  try {
    const payload = req.body;

    // Normalize repo
    let repoObj;
    if (typeof payload.repo === 'string') {
      const [owner, name] = payload.repo.split('/');
      repoObj = {
        fullName: payload.repo,
        owner,
        name
      };
    } else if (payload.repo && typeof payload.repo === 'object') {
      const { fullName, owner, name } = payload.repo;
      if (fullName && (!owner || !name)) {
        const [derivedOwner, derivedName] = fullName.split('/');
        repoObj = {
          fullName,
          owner: owner || derivedOwner,
          name: name || derivedName
        };
      } else if (owner && name && !fullName) {
        repoObj = {
          fullName: `${owner}/${name}`,
          owner,
          name
        };
      } else {
        repoObj = payload.repo;
      }
    }

    if (!repoObj || !repoObj.fullName) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const runId = payload.run?.runId || payload.runId;
    if (!runId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: runId"
      });
    }

    const fallbackSummary = payload.result || {};
    const fallbackTopFindings = payload.result?.topFindings || [];
    const fallbackReportContent = payload.result || payload;

    const normalizedPayload = {
      source: payload.source || "github-actions",
      scanType: "SAST",
      repo: repoObj,
      run: {
        runId,
        status: payload.run?.status || payload.status || "completed",
        timestamp: payload.run?.timestamp || payload.timestamp || new Date().toISOString(),
        branch: payload.run?.branch || payload.branch || null,
        commitSha: payload.run?.commitSha || payload.commitSha || null,
        toolName: payload.run?.toolName || payload.toolName || "semgrep",
        toolVersion: payload.run?.toolVersion || payload.toolVersion || null
      },
      summary: {
        riskScore: payload.summary?.riskScore ?? fallbackSummary.riskScore ?? 0,
        severityCounts: payload.summary?.severityCounts || fallbackSummary.severityCounts || {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        totalFindings: payload.summary?.totalFindings ?? fallbackSummary.totalFindings ?? 0
      },
      topFindings: payload.topFindings || fallbackTopFindings,
      rawReportS3Key: payload.rawReportS3Key || payload.reportS3Key || null,
      report: {
        format: payload.report?.format || "json",
        content: payload.report?.content || fallbackReportContent
      }
    };

    const savedRecord = await saveScanRecord(normalizedPayload);

    return res.status(200).json({
      success: true,
      message: "Scan ingested successfully - updated-backend-v1",
      data: savedRecord
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to process ingest payload",
      error: error.message
    });
  }
}

async function ingestPentest(req, res) {
  try {
    const payload = req.body;
    const runId = payload.runId;
    const repoValue = payload.repo;
    const timestamp = payload.timestamp;
    const summary = payload.summary;
    const reportS3Key = payload.reportS3Key;
    const detailedResults = payload.results?.results || [];
    const hasDetailedResults = payload.results?.results && Array.isArray(payload.results.results);

    if (!repoValue || !runId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    let repoObj;
    if (typeof repoValue === 'string') {
      if (repoValue.includes('/')) {
        const [owner, name] = repoValue.split('/');
        repoObj = {
          fullName: repoValue,
          owner,
          name
        };
      } else {
        repoObj = {
          fullName: `unknown/${repoValue}`,
          owner: "unknown",
          name: repoValue
        };
      }
    } else if (repoValue && typeof repoValue === 'object') {
      const { fullName, owner, name } = repoValue;
      if (fullName && (!owner || !name)) {
        const [derivedOwner, derivedName] = fullName.split('/');
        repoObj = {
          fullName,
          owner: owner || derivedOwner || "unknown",
          name: name || derivedName || fullName
        };
      } else if (owner && name && !fullName) {
        repoObj = {
          fullName: `${owner}/${name}`,
          owner,
          name
        };
      } else {
        repoObj = payload.repo;
      }
    }

    if (!repoObj || !repoObj.fullName) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Handle topFindings and riskScore based on payload format
    let topFindings = [];
    let riskScore = 0;
    let totalFindings = 0;

    if (hasDetailedResults) {
      // Older format with detailed results
      topFindings = detailedResults
        .filter((item) => item.status !== "PASS")
        .map((item) => ({
          title: item.name || item.id || "Pentest finding",
          severity: item.severity || "medium",
          location: item.endpoint || item.path || item.target || "runtime test",
          recommendation:
            item.details ||
            item.recommendation ||
            `Investigate status: ${item.status || "unknown"}`
        }));

      totalFindings = topFindings.length;

      riskScore = typeof summary?.riskScore === 'number'
        ? summary.riskScore
        : Math.min(
            100,
            (detailedResults.filter((item) => item.status === "ERROR").length * 25) +
            (detailedResults.filter((item) => item.status === "FAIL").length * 20) +
            (detailedResults.filter((item) => item.status === "WARNING").length * 10)
          );
    } else {
      // New format: summary-only payload
      topFindings = [];
      
      // Calculate riskScore and totalFindings from summary counts
      if (summary && typeof summary === 'object') {
        const errorCount = summary.ERROR || 0;
        const failCount = summary.FAIL || 0;
        const warningCount = summary.WARNING || 0;
        
        totalFindings = errorCount + failCount + warningCount;
        
        riskScore = Math.min(
          100,
          (errorCount * 25) + (failCount * 20) + (warningCount * 10)
        );
      }
    }

    // Build report content with reportS3Key preserved
    const reportContent = {
      ...payload
    };
    if (reportS3Key) {
      reportContent.reportS3Key = reportS3Key;
    }

    const normalizedPayload = {
      source: "lambda",
      scanType: "PENTEST",
      repo: repoObj,
      run: {
        runId,
        status: "completed",
        timestamp: timestamp || new Date().toISOString(),
        branch: null,
        commitSha: null,
        toolName: payload.tool || "pentest-lambda",
        toolVersion: null
      },
      summary: {
        riskScore,
        severityCounts: summary || {},
        totalFindings
      },
      topFindings,
      rawReportS3Key: reportS3Key || null,
      report: {
        format: "json",
        content: reportContent
      }
    };

    const savedRecord = await saveScanRecord(normalizedPayload);

    return res.status(200).json({
      success: true,
      message: "Pentest scan ingested successfully - updated-backend-v1",
      data: savedRecord
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to process ingest payload",
      error: error.message
    });
  }
}

async function getRepoScans(req, res) {
  const { owner, repo } = req.params;

  try {
    const scans = await getScansByRepoPrimary(owner, repo);

    return res.status(200).json({
      success: true,
      count: scans.length,
      data: scans
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to query scans",
      error: error.message
    });
  }
}

async function getLatestRepoScan(req, res) {
  const { owner, repo } = req.params;

  try {
    const latestScan = await getLatestScanByRepoPrimary(owner, repo);

    if (!latestScan) {
      return res.status(404).json({
        success: false,
        message: "No scan records found for this repository"
      });
    }

    return res.status(200).json({
      success: true,
      data: latestScan
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to query latest scan",
      error: error.message
    });
  }
}

async function getScanDetail(req, res) {
  const { runId } = req.params;

  try {
    const scan = await getScanByRunIdPrimary(runId);

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: "Scan record not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: scan
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to query scan detail",
      error: error.message
    });
  }
}

async function getDashboardSummary(req, res) {
  const { owner, repo } = req.params;

  try {
    const summary = await buildDashboardSummaryPrimary(owner, repo);

    if (!summary.latestSast && !summary.latestPentest) {
      return res.status(404).json({
        success: false,
        message: "No scan records found for this repository"
      });
    }

    return res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to build dashboard summary",
      error: error.message
    });
  }
}

function getRepoDynamoItems(req, res) {
  const { owner, repo } = req.params;
  const items = getDynamoItemsByRepo(owner, repo);

  return res.status(200).json({
    success: true,
    count: items.length,
    data: items
  });
}

function getScanDynamoItem(req, res) {
  const { runId } = req.params;
  const item = getDynamoItemByRunId(runId);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "DynamoDB item not found for this runId"
    });
  }

  return res.status(200).json({
    success: true,
    data: item
  });
}

function getAwsDynamoStatus(req, res) {
  const status = getDynamoClientStatus();

  return res.status(200).json({
    success: true,
    data: status
  });
}

function getAwsS3Status(req, res) {
  const status = getS3ClientStatus();

  return res.status(200).json({
    success: true,
    data: status
  });
}

async function getRepos(req, res) {
  try {
    const repoOptions = await getRepoOptionsPrimary();

    return res.status(200).json({
      success: true,
      data: repoOptions
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve repositories from S3",
      error: error.message
    });
  }
}

module.exports = {
  ingestSAST,
  ingestPentest,
  getRepoScans,
  getLatestRepoScan,
  getScanDetail,
  getDashboardSummary,
  getRepoDynamoItems,
  getScanDynamoItem,
  getAwsDynamoStatus,
  getAwsS3Status,
  getRepos
};