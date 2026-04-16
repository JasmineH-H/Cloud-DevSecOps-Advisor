import { useEffect, useMemo, useState } from "react";

function ScanHistoryTable({ scans, onView, isLoading }) {
  const pageSize = 25;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [scans]);

  const totalItems = scans?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const pagedScans = useMemo(() => {
    if (!scans?.length) {
      return [];
    }
    const start = (page - 1) * pageSize;
    return scans.slice(start, start + pageSize);
  }, [scans, page]);

  return (
    <section className="table-section">
      <div className="section-heading">
        <div>
          <h2>Scan history</h2>
          <p className="section-description">
            Review recent scans and open any run for a deeper inspection.
          </p>
        </div>
      </div>

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
          {isLoading ? (
            <tr>
              <td colSpan="7">Loading scan history...</td>
            </tr>
          ) : pagedScans.length ? (
            pagedScans.map((scan) => (
              <tr key={scan.runId}>
                <td>{scan.timestamp}</td>
                <td>{scan.scanType}</td>
                <td>
                  <span className="table-status-pill">{scan.status}</span>
                </td>
                <td>{scan.riskScore}</td>
                <td>{scan.branch}</td>
                <td>{scan.commitSha}</td>
                <td>
                  <button
                    type="button"
                    className="view-button"
                    onClick={() => onView(scan.runId)}
                  >
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

      {!isLoading && totalItems > 0 && (
        <div className="table-pagination">
          <span>
            Showing {(page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, totalItems)} of {totalItems}
          </span>
          <div className="table-pagination-controls">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default ScanHistoryTable;
