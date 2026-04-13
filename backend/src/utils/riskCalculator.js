function normalizeRiskScore(rawScore = 0) {
  const raw = Number(rawScore || 0);
  const normalized = 100 * (1 - Math.exp(-raw / 40));
  return Math.round(normalized);
}

function calculateSastRiskScores(severityCounts = {}) {
  const counts = {
    critical: Number(severityCounts.critical || 0),
    high: Number(severityCounts.high || 0),
    medium: Number(severityCounts.medium || 0),
    low: Number(severityCounts.low || 0),
  };

  const rawRiskScore =
    counts.critical * 20 +
    counts.high * 8 +
    counts.medium * 3 +
    counts.low * 1;

  return {
    rawRiskScore,
    riskScore: normalizeRiskScore(rawRiskScore),
  };
}

function calculatePentestRiskScores(summaryOrResults = {}) {
  let errorCount = 0;
  let failCount = 0;
  let warningCount = 0;

  if (!Array.isArray(summaryOrResults)) {
    errorCount = Number(summaryOrResults.ERROR || 0);
    failCount = Number(summaryOrResults.FAIL || 0);
    warningCount = Number(summaryOrResults.WARNING || 0);
  } else {
    for (const item of summaryOrResults) {
      const status = String(item?.status || "").toUpperCase();
      if (status === "ERROR") errorCount += 1;
      else if (status === "FAIL") failCount += 1;
      else if (status === "WARNING") warningCount += 1;
    }
  }

  const rawRiskScore =
    errorCount * 25 +
    failCount * 20 +
    warningCount * 10;

  return {
    rawRiskScore,
    riskScore: normalizeRiskScore(rawRiskScore),
  };
}

module.exports = {
  normalizeRiskScore,
  calculateSastRiskScores,
  calculatePentestRiskScores,
};