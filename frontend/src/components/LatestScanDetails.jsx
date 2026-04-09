function LatestScanCard({ title, scan }) {
  return (
    <div className="card detail-card">
      <h3>{title}</h3>
      <p><strong>Status:</strong> {scan?.status ?? "N/A"}</p>
      <p><strong>Timestamp:</strong> {scan?.timestamp ?? "N/A"}</p>
      <p><strong>Branch:</strong> {scan?.branch ?? "N/A"}</p>
      <p><strong>Commit:</strong> {scan?.commitSha ?? "N/A"}</p>
      <p><strong>Tool:</strong> {scan?.toolName ?? "N/A"}</p>
    </div>
  );
}

function LatestScanDetails({ summary }) {
  return (
    <section className="details-grid">
      <LatestScanCard title="Latest SAST" scan={summary?.latestSast} />
      <LatestScanCard title="Latest Pentest" scan={summary?.latestPentest} />
    </section>
  );
}

export default LatestScanDetails;