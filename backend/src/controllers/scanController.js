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

async function ingestSast(req, res) {
  const payload = req.body;
  const errors = validateIngestPayload(payload, "SAST");

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid ingest payload",
      errors
    });
  }

  const savedRecord = await saveScanRecord(payload);
  let simulatedGitHubComment = null;

  if (savedRecord.scanType === "SAST") {
    simulatedGitHubComment = formatGitHubComment(savedRecord);


    console.log("\n===== GitHub PR Comment (Simulated) =====\n");
    console.log(simulatedGitHubComment);
    console.log("\n========================================\n");
  }

  return res.status(200).json({
    success: true,
    message: "SAST scan result received successfully",
    data: savedRecord,
    simulatedGitHubComment
  });
}


async function ingestPentest(req, res) {
  const payload = req.body;
  const errors = validateIngestPayload(payload, "PENTEST");

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid ingest payload",
      errors
    });
  }

  const savedRecord = await saveScanRecord(payload);

  return res.status(200).json({
    success: true,
    message: "PENTEST scan result received successfully",
    data: savedRecord
  });
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
  ingestSast,
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