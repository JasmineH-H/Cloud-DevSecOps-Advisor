const {
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  ListBucketsCommand
} = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/aws");

const BUCKET_NAME = process.env.REPORTS_BUCKET || process.env.S3_BUCKET;

function requireBucketName() {
  if (!BUCKET_NAME) {
    throw new Error("Missing reports bucket env var. Set REPORTS_BUCKET (or S3_BUCKET).");
  }
  return BUCKET_NAME;
}

async function uploadReportToS3(key, data) {
  const command = new PutObjectCommand({
    Bucket: requireBucketName(),
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json"
  });

  await s3Client.send(command);
}

async function listReportObjects(prefix) {
  const command = new ListObjectsV2Command({
    Bucket: requireBucketName(),
    Prefix: prefix
  });

  const response = await s3Client.send(command);
  
  if (!response.Contents) {
    return [];
  }

  return response.Contents.map((obj) => obj.Key);
}

async function getJsonObject(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: requireBucketName(),
      Key: key
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body.transformToString();
    const jsonObject = JSON.parse(bodyString);

    return jsonObject;
  } catch (error) {
    console.error("Error reading S3 object:", error);
    return null;
  }
}

async function getS3ClientStatus() {
  try {
    await s3Client.send(new ListBucketsCommand({}));
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error.message
    };
  }
}

module.exports = {
  uploadReportToS3,
  listReportObjects,
  getJsonObject,
  getS3ClientStatus
};
