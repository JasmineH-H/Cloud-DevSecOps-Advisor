const { PutCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { ListTablesCommand } = require("@aws-sdk/client-dynamodb");
const { dynamoDocClient } = require("../config/aws");

const TABLE_NAME = process.env.SCAN_RESULTS_TABLE;

if (!TABLE_NAME) {
  throw new Error("Missing SCAN_RESULTS_TABLE env var.");
}

async function saveToDynamo(item) {
  // Accepts summary item (no reportContent)
  // Fields: repo, timestamp, runId, scanType, status, riskScore, severityCounts,
  //         totalFindings, topFindings, branch, commitSha, toolName, toolVersion,
  //         reportFormat, reportS3Key, rawReportS3Key
  const requiredFields = ["repo", "timestamp", "runId", "scanType", "status"];
  const missing = requiredFields.filter((field) => {
    const value = item?.[field];
    return value === undefined || value === null || String(value).trim() === "";
  });

  if (missing.length > 0) {
    throw new Error(
      `Invalid DynamoDB item: missing required field(s): ${missing.join(", ")}`
    );
  }

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  });

  await dynamoDocClient.send(command);
}

async function getScansByRepoFromDynamo(repo) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "repo = :repoValue",
    ExpressionAttributeValues: {
      ":repoValue": repo
    },
    ScanIndexForward: false
  });

  const response = await dynamoDocClient.send(command);
  return response.Items || [];
}

async function getScanByRunIdFromDynamo(runId) {
  const queryByValue = async (value) => {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "runId-index",
      KeyConditionExpression: "runId = :runIdValue",
      ExpressionAttributeValues: {
        ":runIdValue": value
      },
      Limit: 1
    });

    const response = await dynamoDocClient.send(command);
    return response.Items && response.Items.length > 0 ? response.Items[0] : null;
  };

  // First try as-is (works for string runIds)
  const primary = await queryByValue(runId);
  if (primary) {
    return primary;
  }

  // Fallback for scans stored with numeric runId types.
  const numericRunId = Number(runId);
  if (!Number.isNaN(numericRunId) && String(numericRunId) === String(runId)) {
    return queryByValue(numericRunId);
  }

  return null;
}

async function getRepoOptionsFromDynamo() {
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME
    });

    const response = await dynamoDocClient.send(command);
    const items = response.Items || [];

    if (items.length === 0) {
      return [];
    }

    // Group by owner/repo extracted from repo field
    const ownerMap = new Map();

    for (const item of items) {
      if (!item.repo) continue;

      let owner, repo;
      if (item.repo.includes("/")) {
        const [ownerPart, repoPart] = item.repo.split("/");
        owner = ownerPart;
        repo = repoPart;
      } else {
        owner = "unknown";
        repo = item.repo;
      }

      if (!ownerMap.has(owner)) {
        ownerMap.set(owner, new Set());
      }
      ownerMap.get(owner).add(repo);
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
    console.error("[getRepoOptionsFromDynamo] Error:", error.message);
    return [];
  }
}

async function getDynamoClientStatus() {
  try {
    await dynamoDocClient.send(new ListTablesCommand({ Limit: 1 }));
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error.message
    };
  }
}

module.exports = {
  saveToDynamo,
  getScansByRepoFromDynamo,
  getScanByRunIdFromDynamo,
  getRepoOptionsFromDynamo,
  getDynamoClientStatus
};
