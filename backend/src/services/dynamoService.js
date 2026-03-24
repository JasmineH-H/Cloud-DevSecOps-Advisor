const { PutCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamoDocClient } = require("../config/aws");

const TABLE_NAME = process.env.SCAN_RESULTS_TABLE || "ScanResults";

async function saveToDynamo(item) {
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

module.exports = {
  saveToDynamo,
  getScansByRepoFromDynamo,
  getScanByRunIdFromDynamo
};