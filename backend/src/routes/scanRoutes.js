const express = require("express");
const {
  ingestSAST,
  ingestPentest,
  getRepoScans,
  getLatestRepoScan,
  getScanDetail,
  getScanFindings,
  getDashboardSummary,
  getRepoDynamoItems,
  getScanDynamoItem,
  getAwsDynamoStatus,
  getAwsS3Status,
  getRepos,
  runPentestNow,
  schedulePentest,
  getPentestScheduleConfig
} = require("../controllers/scanController");
const { verifyIngestToken, verifyDebugToken } = require("../middleware/authMiddleware");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

const ingestWindowMs = Number(process.env.INGEST_RATE_LIMIT_WINDOW_MS || 60_000);
const ingestMax = Number(process.env.INGEST_RATE_LIMIT_MAX || 60);

const sastIngestRateLimit = createRateLimiter({
  windowMs: ingestWindowMs,
  maxRequests: ingestMax,
  keyPrefix: "ingest-sast"
});

const pentestIngestRateLimit = createRateLimiter({
  windowMs: ingestWindowMs,
  maxRequests: ingestMax,
  keyPrefix: "ingest-pentest"
});

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend API is running"
  });
});

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend API is running"
  });
});

router.post(
  "/ingest/sast",
  sastIngestRateLimit,
  verifyIngestToken(process.env.INGEST_TOKEN_SAST, "ingest_token_sast"),
  ingestSAST
);

router.post(
  "/ingest/pentest",
  pentestIngestRateLimit,
  verifyIngestToken(process.env.INGEST_TOKEN_PENTEST, "ingest_token_pentest"),
  ingestPentest
);
router.get("/repos", getRepos);
router.get("/repos/:owner/:repo/scans", getRepoScans);
router.get("/repos/:owner/:repo/scans/latest", getLatestRepoScan);
router.get("/scan", getScanDetail);
router.get("/scan/:runId", getScanDetail);
router.get("/scan/:runId/findings", getScanFindings);
router.get("/repos/:owner/:repo/dashboard-summary", getDashboardSummary);

router.get(
  "/debug/repos/:owner/:repo/dynamo-items",
  verifyDebugToken(process.env.DEBUG_API_TOKEN),
  getRepoDynamoItems
);
router.get(
  "/debug/scan/:runId/dynamo-item",
  verifyDebugToken(process.env.DEBUG_API_TOKEN),
  getScanDynamoItem
);
router.get(
  "/debug/aws/dynamo-status",
  verifyDebugToken(process.env.DEBUG_API_TOKEN),
  getAwsDynamoStatus
);
router.get(
  "/debug/aws/s3-status",
  verifyDebugToken(process.env.DEBUG_API_TOKEN),
  getAwsS3Status
);
router.post("/pentest/run-now", runPentestNow);
router.post("/pentest/schedule", schedulePentest);
router.get("/pentest/schedule", getPentestScheduleConfig);

module.exports = router;
