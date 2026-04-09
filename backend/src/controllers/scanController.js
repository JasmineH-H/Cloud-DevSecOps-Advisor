const { validateIngestPayload } = require("../utils/validateIngestPayload");
const {
  saveScanRecord,
  getScansByRepo,
  getLatestScanByRepo,
  getScanByRunId,
  buildDashboardSummary,
  getDynamoItemByRunId,
  getDynamoItemsByRepo,
  getRepoOptions,
  getScansByRepoLive,
  getLatestScanByRepoLive,
  buildDashboardSummaryLive,
  getScanByRunIdLive,
} = require("../services/scanService");
const { getDynamoClientStatus } = require("../services/dynamoService");
const { getS3ClientStatus } = require("../services/s3Service");
const { formatGitHubComment } = require("../utils/githubCommentFormatter");

function validateAuthorizationHeader(req, res, expectedToken) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      message: "Missing Authorization header"
    });
    return false;
  }

  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Invalid Authorization header format"
    });
    return false;
  }

  const token = authHeader.split(" ")[1];

  if (token !== expectedToken) {
    res.status(401).json({
      success: false,
      message: "Invalid ingest token"
    });
    return false;
  }

  return true;
}

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

    const runId = payload.run?.runId;
    if (!runId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const normalizedPayload = {
      source: "github-actions",
      scanType: "SAST",
      repo: repoObj,
      run: {
        runId,
        status: payload.run?.status || "completed",
        timestamp: payload.run?.timestamp || new Date().toISOString(),
        branch: payload.run?.branch || null,
        commitSha: payload.run?.commitSha || null,
        toolName: payload.run?.toolName || "unknown",
        toolVersion: payload.run?.toolVersion || null
      },
      summary: {
        riskScore: payload.summary?.riskScore,
        severityCounts: payload.summary?.severityCounts,
        totalFindings: payload.summary?.totalFindings || 0
      },
      topFindings: payload.topFindings || [],
      report: {
        format: payload.report?.format || "json",
        content: payload.report?.content || payload
      }
    };

    const savedRecord = await saveScanRecord(normalizedPayload);

    return res.status(200).json({
      success: true,
      message: "Scan ingested successfully",
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
    const detailedResults = payload.results?.results || [];

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
          fullName: repoValue,
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

    const topFindings = detailedResults
      .filter((item) => item.status !== "PASS")
      .map((item) => ({
        id: item.id,
        name: item.name,
        severity: item.severity,
        status: item.status,
        details: item.details
      }));

    const riskScore = typeof summary?.riskScore === 'number'
      ? summary.riskScore
      : Math.min(
          100,
          (detailedResults.filter((item) => item.status === "ERROR").length * 25) +
          (detailedResults.filter((item) => item.status === "FAIL").length * 20) +
          (detailedResults.filter((item) => item.status === "WARNING").length * 10)
        );

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
        toolName: "pentest-lambda",
        toolVersion: null
      },
      summary: {
        riskScore,
        severityCounts: summary || {},
        totalFindings: topFindings.length
      },
      topFindings,
      report: {
        format: "json",
        content: payload
      }
    };

    const savedRecord = await saveScanRecord(normalizedPayload);

    return res.status(200).json({
      success: true,
      message: "Pentest scan ingested successfully",
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
    const scans = await getScansByRepoLive(owner, repo);

    return res.status(200).json({
      success: true,
      count: scans.length,
      data: scans
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to query scans from DynamoDB",
      error: error.message
    });
  }
}

async function getLatestRepoScan(req, res) {
  const { owner, repo } = req.params;

  try {
    const latestScan = await getLatestScanByRepoLive(owner, repo);

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
      message: "Failed to query latest scan from DynamoDB",
      error: error.message
    });
  }
}

async function getScanDetail(req, res) {
  const { runId } = req.params;

  try {
    const scan = await getScanByRunIdLive(runId);

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
      message: "Failed to query scan detail from DynamoDB",
      error: error.message
    });
  }
}

async function getDashboardSummary(req, res) {
  const { owner, repo } = req.params;

  try {
    const summary = await buildDashboardSummaryLive(owner, repo);

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
      message: "Failed to build dashboard summary from DynamoDB",
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

function getRepos(req, res) {
  const repoOptions = getRepoOptions();

  return res.status(200).json({
    success: true,
    data: repoOptions
  });
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