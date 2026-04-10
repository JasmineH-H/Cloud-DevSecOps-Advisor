const { PutCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamoDocClient } = require("../config/aws");

const TABLE_NAME = process.env.SCAN_RESULTS_TABLE || "ScanResults";

async function saveToDynamo(item) {
  // Accepts summary item (no reportContent)
  // Fields: repo, timestamp, runId, scanType, status, riskScore, severityCounts,
  //         totalFindings, topFindings, branch, commitSha, toolName, toolVersion,
  //         reportFormat, reportS3Key, rawReportS3Key
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
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "runId = :runIdValue",
    ExpressionAttributeValues: {
      ":runIdValue": runId
    }
  });

  const response = await dynamoDocClient.send(command);

  if (!response.Items || response.Items.length === 0) {
    return null;
  }

  return response.Items[0];
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

module.exports = {
  saveToDynamo,
  getScansByRepoFromDynamo,
  getScanByRunIdFromDynamo,
  getRepoOptionsFromDynamo
};