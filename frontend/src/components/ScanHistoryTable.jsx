import { useEffect, useMemo, useState } from "react";
import { fetchScanDetail } from "../services/api";

function ScanHistoryTable({ scans, onView, isLoading }) {
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("All");
  const [selectedScan, setSelectedScan] = useState(null);
  const [scanDetail, setScanDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [scans]);

  useEffect(() => {
    const loadScanDetail = async () => {
      if (!selectedScan) {
        setScanDetail(null);
        return;
      }

      setDetailLoading(true);
      try {
        const detail = await fetchScanDetail(selectedScan.runId);
        setScanDetail(detail);
      } catch (error) {
        console.error("Failed to load scan detail:", error);
        setScanDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };

    loadScanDetail();
  }, [selectedScan]);

  const filteredScans = useMemo(() => {
    if (!scans?.length) {
      return [];
    }
    if (filter === "All") {
      return scans;
    }
    return scans.filter(
      (scan) =>
        String(scan.scanType || "").toUpperCase() === filter.toUpperCase(),
    );
  }, [scans, filter]);

  const totalItems = filteredScans?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const pagedScans = useMemo(() => {
    if (!filteredScans?.length) {
      return [];
    }
    const start = (page - 1) * pageSize;
    return filteredScans.slice(start, start + pageSize);
  }, [filteredScans, page]);

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

      <div className="table-controls">
        <button
          type="button"
          className={`filter-button ${filter === "All" ? "active" : ""}`}
          onClick={() => {
            setFilter("All");
            setPage(1);
          }}
        >
          All
        </button>
        <button
          type="button"
          className={`filter-button ${filter === "SAST" ? "active" : ""}`}
          onClick={() => {
            setFilter("SAST");
            setPage(1);
          }}
        >
          SAST
        </button>
        <button
          type="button"
          className={`filter-button ${filter === "PENTEST" ? "active" : ""}`}
          onClick={() => {
            setFilter("PENTEST");
            setPage(1);
          }}
        >
          Pentest
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Scan Type</th>
            <th>Status</th>
            <th>Risk Score</th>
            <th>Branch</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan="6">Loading scan history...</td>
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
                <td>
                  <button
                    type="button"
                    className="view-button"
                    onClick={() => {
                      setSelectedScan(scan);
                      onView(scan.runId);
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6">No scan history found.</td>
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

      {selectedScan && (
        <div className="modal-overlay" onClick={() => setSelectedScan(null)}>
          <div
            className="modal-content modal-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Scan Details - {selectedScan.scanType}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedScan(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div className="modal-loading">
                  Loading scan details from DynamoDB...
                </div>
              ) : scanDetail ? (
                <>
                  {/* Scan Information Section */}
                  <div className="detail-section">
                    <h3 className="detail-section-title">Scan Information</h3>
                    <div className="detail-row">
                      <span className="detail-label">Run ID:</span>
                      <span className="detail-value">{scanDetail.runId}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Repository:</span>
                      <span className="detail-value">{scanDetail.repo}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Scan Type:</span>
                      <span className="detail-value">
                        {scanDetail.scanType}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Status:</span>
                      <span className="detail-value">
                        <span className="table-status-pill">
                          {scanDetail.status}
                        </span>
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Branch:</span>
                      <span className="detail-value">{scanDetail.branch}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Timestamp:</span>
                      <span className="detail-value">
                        {new Date(scanDetail.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Commit SHA:</span>
                      <span
                        className="detail-value"
                        title={scanDetail.commitSha}
                      >
                        {scanDetail.commitSha?.substring(0, 8)}...
                      </span>
                    </div>
                  </div>

                  {/* Risk Assessment Section */}
                  <div className="detail-section">
                    <h3 className="detail-section-title">Risk Assessment</h3>
                    <div className="detail-row">
                      <span className="detail-label">Risk Score:</span>
                      <span className="detail-value">
                        {scanDetail.riskScore}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Raw Risk Score:</span>
                      <span className="detail-value">
                        {scanDetail.rawRiskScore}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Total Findings:</span>
                      <span className="detail-value">
                        {scanDetail.totalFindings}
                      </span>
                    </div>
                  </div>

                  {/* Tool Information */}
                  <div className="detail-section">
                    <h3 className="detail-section-title">Tool Information</h3>
                    <div className="detail-row">
                      <span className="detail-label">Tool:</span>
                      <span className="detail-value">
                        {scanDetail.toolName}
                      </span>
                    </div>
                    {scanDetail.toolVersion && (
                      <div className="detail-row">
                        <span className="detail-label">Version:</span>
                        <span className="detail-value">
                          {scanDetail.toolVersion}
                        </span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="detail-label">Report Format:</span>
                      <span className="detail-value">
                        {scanDetail.reportFormat}
                      </span>
                    </div>
                  </div>

                  {/* S3 Reports */}
                  <div className="detail-section">
                    <h3 className="detail-section-title">Reports</h3>
                    <div className="reports-list">
                      {scanDetail.rawReportS3Key && (
                        <div className="report-url-row">
                          <span className="report-label">Raw Report:</span>
                          <code className="report-url">
                            {scanDetail.rawReportS3Key}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="modal-error">
                  Failed to load scan details from DynamoDB
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setSelectedScan(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ScanHistoryTable;
