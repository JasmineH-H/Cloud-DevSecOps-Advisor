function calculateSastRiskScore(severityCounts = {}) {
    const counts = {
      critical: Number(severityCounts.critical || 0),
      high: Number(severityCounts.high || 0),
      medium: Number(severityCounts.medium || 0),
      low: Number(severityCounts.low || 0),
    };
  
    return (
      counts.critical * 10 +
      counts.high * 7 +
      counts.medium * 4 +
      counts.low * 1
    );
  }
  
  function calculatePentestRiskScore(summaryOrResults = {}) {
    // Supports summary-only format: { ERROR, FAIL, WARNING, PASS }
    if (!Array.isArray(summaryOrResults)) {
      const errorCount = Number(summaryOrResults.ERROR || 0);
      const failCount = Number(summaryOrResults.FAIL || 0);
      const warningCount = Number(summaryOrResults.WARNING || 0);
  
      return Math.min(
        100,
        errorCount * 25 + failCount * 20 + warningCount * 10
      );
    }
  
    // Supports detailed-results array format
    let errorCount = 0;
    let failCount = 0;
    let warningCount = 0;
  
    for (const item of summaryOrResults) {
      const status = String(item?.status || "").toUpperCase();
      if (status === "ERROR") errorCount += 1;
      else if (status === "FAIL") failCount += 1;
      else if (status === "WARNING") warningCount += 1;
    }
  
    return Math.min(
      100,
      errorCount * 25 + failCount * 20 + warningCount * 10
    );
  }
  
  module.exports = {
    calculateSastRiskScore,
    calculatePentestRiskScore,
  };