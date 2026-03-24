const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { S3Client } = require("@aws-sdk/client-s3");

const REGION = process.env.AWS_REGION || "us-east-1";

const dynamoRawClient = new DynamoDBClient({
  region: REGION
});

const dynamoDocClient = DynamoDBDocumentClient.from(dynamoRawClient);

const s3Client = new S3Client({
  region: REGION
});

module.exports = {
  dynamoDocClient,
  s3Client,
  REGION
};