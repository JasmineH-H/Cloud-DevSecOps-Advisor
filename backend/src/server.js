require("dotenv").config();

const requiredEnv = [
  "SCAN_RESULTS_TABLE",
  "REPORTS_BUCKET",
  "INGEST_TOKEN_SAST",
  "INGEST_TOKEN_PENTEST",
  "DEBUG_API_TOKEN",
  "PENTEST_LAMBDA_NAME",
  "PENTEST_SCHEDULE_RULE"
];

const missingEnv = requiredEnv.filter((name) => !String(process.env[name] || "").trim());
if (missingEnv.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missingEnv.join(", ")}. ` +
      "Update ECS task environment before starting backend."
  );
  process.exit(1);
}

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
