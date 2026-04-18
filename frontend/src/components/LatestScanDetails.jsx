function LatestScanCard({ title, scan, compact = false }) {
  const isSast = title === "Latest SAST";

  return (
    <article
      className={`card detail-card${compact ? " detail-card-compact" : ""}`}
    >
      <dl className="detail-list">
        {isSast && (
          <div>
            <dt>Scan ID</dt>
            <dd>{scan?.runId ?? "N/A"}</dd>
          </div>
        )}
        <div>
          <dt>Timestamp</dt>
          <dd>{scan?.timestamp ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>{scan?.branch ?? "N/A"}</dd>
        </div>
        {!isSast && (
          <div>
            <dt>Commit</dt>
            <dd>{scan?.commitSha ?? "N/A"}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

function LatestScanDetails({ summary }) {
  return (
    <section className="details-grid">
      {summary?.latestSast && (
        <LatestScanCard
          title="Latest SAST"
          scan={summary?.latestSast}
          compact
        />
      )}
      {summary?.latestPentest && (
        <LatestScanCard title="Latest Pentest" scan={summary?.latestPentest} />
      )}
    </section>
  );
}

export default LatestScanDetails;
