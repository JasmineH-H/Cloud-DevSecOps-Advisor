const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/aws");

const BUCKET_NAME = process.env.REPORTS_BUCKET || "scan-reports-repo-dev";

async function uploadReportToS3(key, data) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json"
  });

  await s3Client.send(command);
}

module.exports = {
  uploadReportToS3
};