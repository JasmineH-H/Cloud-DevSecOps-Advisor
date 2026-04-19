function getScoreClass(score) {
  if (score === null || score === undefined || score === "N/A") {
    return "";
  }

  if (score >= 70) {
    return "score-high";
  }

  if (score >= 50) {
    return "score-medium";
  }

  return "score-low";
}

function getSeverityTotal(severityCounts = {}) {
  return [
    severityCounts.critical,
    severityCounts.high,
    severityCounts.medium,
    severityCounts.low,
  ].reduce((total, value) => total + Number(value || 0), 0);
}

function buildDonutGradient(severityCounts = {}) {
  const high =
    Number(severityCounts.critical || 0) + Number(severityCounts.high || 0);
  const medium = Number(severityCounts.medium || 0);
  const low = Number(severityCounts.low || 0);
  const total = high + medium + low;

  if (!total) {
    return "#d6d0e8 0deg 360deg";
  }

  const highDegrees = (high / total) * 360;
  const mediumDegrees = (medium / total) * 360;
  const lowDegrees = 360 - highDegrees - mediumDegrees;

  return [
    `#d77a61 0deg ${highDegrees}deg`,
    `#d6b760 ${highDegrees}deg ${highDegrees + mediumDegrees}deg`,
    `#b8d660 ${highDegrees + mediumDegrees}deg 360deg`,
  ].join(", ");
}

function formatCount(value) {
  return Number(value || 0);
}

function OverviewCards({ summary, variant = "default" }) {
  const totalPrioritizedFindings =
    summary?.prioritizedVulnerabilities?.length || 0;

  if (variant === "sast") {
    const severityCounts = summary?.latestSast?.severityCounts || {};
    const highCount =
      Number(severityCounts.critical || 0) + Number(severityCounts.high || 0);
    const mediumCount = Number(severityCounts.medium || 0);
    const lowCount = Number(severityCounts.low || 0);
    const totalFindings =
      summary?.latestSast?.totalFindings ??
      getSeverityTotal(severityCounts) ??
      totalPrioritizedFindings;
    const donutBackground = buildDonutGradient(severityCounts);

    return (
      <section className="sast-score-grid">
        <div className="sast-score-card sast-score-card-total sast-score-card-wide">
          <span className="sast-score-label">Total Vulnerabilities</span>
          <div className="sast-score-total-content">
            <div
              className="sast-score-donut"
              style={{ background: `conic-gradient(${donutBackground})` }}
              aria-hidden="true"
            >
              <div className="sast-score-donut-center">
                <strong>{totalFindings}</strong>
              </div>
            </div>
            <div
              className="sast-score-legend"
              aria-label="SAST severity legend"
            >
              <div>
                <span className="legend-dot legend-dot-high" />
                High: {formatCount(highCount)}
              </div>
              <div>
                <span className="legend-dot legend-dot-medium" />
                Medium: {formatCount(mediumCount)}
              </div>
              <div>
                <span className="legend-dot legend-dot-low" />
                Low: {formatCount(lowCount)}
              </div>
            </div>
          </div>
        </div>

        <div className="sast-score-card sast-score-card-risk">
          <span className="sast-score-label">Risk Score</span>
          <strong className={getScoreClass(summary?.latestSast?.riskScore)}>
            {summary?.latestSast?.riskScore ?? "N/A"}
          </strong>
        </div>
      </section>
    );
  }

  if (variant === "pentest") {
    const severityCounts = summary?.latestPentest?.severityCounts || {};
    const failCount = Number(severityCounts.FAIL || 0);
    const warningCount = Number(severityCounts.WARNING || 0);
    const errorCount = Number(severityCounts.ERROR || 0);
    const passCount = Number(severityCounts.PASS || 0);

    const highCount = failCount + errorCount;
    const mediumCount = warningCount;
    const lowCount = passCount;

    const totalTests =
      summary?.latestPentest?.totalFindings !== undefined
        ? Number(summary?.latestPentest?.totalFindings || 0) + passCount
        : highCount + mediumCount + lowCount;

    const donutBackground = buildDonutGradient({
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    });

    return (
      <section className="sast-score-grid">
        <div className="sast-score-card sast-score-card-total sast-score-card-wide">
          <span className="sast-score-label">Total Tests</span>
          <div className="sast-score-total-content">
            <div
              className="sast-score-donut"
              style={{ background: `conic-gradient(${donutBackground})` }}
              aria-hidden="true"
            >
              <div className="sast-score-donut-center">
                <strong>{totalTests}</strong>
              </div>
            </div>
            <div
              className="sast-score-legend"
              aria-label="Pentest status legend"
            >
              <div>
                <span className="legend-dot legend-dot-high" />
                Fail/Error: {formatCount(highCount)}
              </div>
              <div>
                <span className="legend-dot legend-dot-medium" />
                Warning: {formatCount(mediumCount)}
              </div>
              <div>
                <span className="legend-dot legend-dot-low" />
                Passed: {formatCount(lowCount)}
              </div>
            </div>
          </div>
        </div>

        <div className="sast-score-card sast-score-card-risk">
          <span className="sast-score-label">Risk Score</span>
          <strong className={getScoreClass(summary?.latestPentest?.riskScore)}>
            {summary?.latestPentest?.riskScore ?? "N/A"}
          </strong>
        </div>
      </section>
    );
  }

  return (
    <section className="cards-grid">
      <div className="card">
        <h3>Overall Risk Score</h3>
        <p className={`score ${getScoreClass(summary?.overallRiskScore)}`}>
          {summary?.overallRiskScore ?? "N/A"}
        </p>
      </div>

      <div className="card">
        <h3>Latest SAST Score</h3>
        <p className={`score ${getScoreClass(summary?.latestSast?.riskScore)}`}>
          {summary?.latestSast?.riskScore ?? "N/A"}
        </p>
      </div>

      <div className="card">
        <h3>Latest Pentest Score</h3>
        <p
          className={`score ${getScoreClass(summary?.latestPentest?.riskScore)}`}
        >
          {summary?.latestPentest?.riskScore ?? "N/A"}
        </p>
      </div>
    </section>
  );
}

export default OverviewCards;
