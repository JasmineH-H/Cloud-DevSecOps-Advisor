function ScanHistoryTable({ scans, onView }) {
  return (
    <section className="table-section">
      <h2>Scan History</h2>

      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Scan Type</th>
            <th>Status</th>
            <th>Risk Score</th>
            <th>Branch</th>
            <th>Commit SHA</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {scans?.length ? (
            scans.map((scan) => (
              <tr key={scan.runId}>
                <td>{scan.timestamp}</td>
                <td>{scan.scanType}</td>
                <td>{scan.status}</td>
                <td>{scan.riskScore}</td>
                <td>{scan.branch}</td>
                <td>{scan.commitSha}</td>
                <td>
                  <button type="button" className="view-button" onClick={() => onView(scan.runId)}>
                    View
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7">No scan history found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default ScanHistoryTable;