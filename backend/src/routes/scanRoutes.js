const express = require("express");
const {
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
} = require("../controllers/scanController");
const { verifyIngestToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend API is running"
  });
});

router.post(
  "/ingest/sast",
  verifyIngestToken(process.env.INGEST_TOKEN_SAST),
  ingestSast
);

router.post(
  "/ingest/pentest",
  verifyIngestToken(process.env.INGEST_TOKEN_PENTEST),
  ingestPentest
);
router.get("/repos", getRepos);
router.get("/repos/:owner/:repo/scans", getRepoScans);
router.get("/repos/:owner/:repo/scans/latest", getLatestRepoScan);
router.get("/scan/:runId", getScanDetail);
router.get("/repos/:owner/:repo/dashboard-summary", getDashboardSummary);

router.get("/debug/repos/:owner/:repo/dynamo-items", getRepoDynamoItems);
router.get("/debug/scan/:runId/dynamo-item", getScanDynamoItem);

router.get("/debug/aws/dynamo-status", getAwsDynamoStatus);
router.get("/debug/aws/s3-status", getAwsS3Status);

module.exports = router;