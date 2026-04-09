const { PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/aws");

const BUCKET_NAME = process.env.REPORTS_BUCKET || "devsecops-advisor-reports-714234925361";

async function uploadReportToS3(key, data) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json"
  });

  await s3Client.send(command);
}

async function listReportObjects(prefix) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix
    });

    const response = await s3Client.send(command);
    
    if (!response.Contents) {
      return [];
    }

    return response.Contents.map((obj) => obj.Key);
  } catch (error) {
    console.error("Error listing S3 objects:", error);
    return [];
  }
}

async function getJsonObject(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
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

module.exports = {
  uploadReportToS3,
  listReportObjects,
  getJsonObject
};