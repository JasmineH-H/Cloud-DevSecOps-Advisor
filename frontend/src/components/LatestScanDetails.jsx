function LatestScanCard({ title, scan }) {
  return (
    <article className="card detail-card">
      <div className="section-heading compact-heading">
        <div>
          <h3>{title}</h3>
        </div>
      </div>

      <dl className="detail-list">
        <div>
          <dt>Status</dt>
          <dd>{scan?.status ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Timestamp</dt>
          <dd>{scan?.timestamp ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>{scan?.branch ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Commit</dt>
          <dd>{scan?.commitSha ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Tool</dt>
          <dd>{scan?.toolName ?? "N/A"}</dd>
        </div>
      </dl>
    </article>
  );
}

function LatestScanDetails({ summary }) {
  return (
    <section className="details-grid">
      {summary?.latestSast && (
        <LatestScanCard title="Latest SAST" scan={summary?.latestSast} />
      )}
      {summary?.latestPentest && (
        <LatestScanCard title="Latest Pentest" scan={summary?.latestPentest} />
      )}
    </section>
  );
}

export default LatestScanDetails;
