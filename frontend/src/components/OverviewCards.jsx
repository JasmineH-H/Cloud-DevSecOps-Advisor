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

function OverviewCards({ summary }) {
  const totalPrioritizedFindings =
    summary?.prioritizedVulnerabilities?.length || 0;

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
        <p className={`score ${getScoreClass(summary?.latestPentest?.riskScore)}`}>
          {summary?.latestPentest?.riskScore ?? "N/A"}
        </p>
      </div>

      <div className="card">
        <h3>Total Prioritized Findings</h3>
        <p className="score">{totalPrioritizedFindings}</p>
      </div>
    </section>
  );
}

export default OverviewCards;