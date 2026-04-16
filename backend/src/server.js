require("dotenv").config();

const enableDebugRoutes =
  String(process.env.ENABLE_DEBUG_ROUTES || "false") === "true";

const requiredEnv = [
  "SCAN_RESULTS_TABLE",
  "REPORTS_BUCKET",
  "INGEST_TOKEN_SAST",
  "INGEST_TOKEN_PENTEST",
  "PENTEST_LAMBDA_NAME",
  "PENTEST_SCHEDULE_RULE",
];

if (enableDebugRoutes) {
  requiredEnv.push("DEBUG_API_TOKEN");
}

const missingEnv = requiredEnv.filter(
  (name) => !String(process.env[name] || "").trim(),
);
if (missingEnv.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missingEnv.join(", ")}. ` +
      "Update ECS task environment before starting backend.",
  );
  process.exit(1);
}

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
