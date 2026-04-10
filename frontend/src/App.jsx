import { useEffect, useMemo, useState } from "react";
import RepoForm from "./components/RepoForm";
import OverviewCards from "./components/OverviewCards";
import LatestScanDetails from "./components/LatestScanDetails";
import VulnerabilityTable from "./components/VulnerabilityTable";
import ScanHistoryTable from "./components/ScanHistoryTable";
import {
  fetchDashboardSummary,
  fetchRepoOptions,
  fetchRepoScans,
  fetchScanDetail
} from "./services/api";
import "./index.css";

function App() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [repoData, setRepoData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const ownerOptions = useMemo(() => {
    return repoData.map((item) => item.owner);
  }, [repoData]);

  const repoOptions = useMemo(() => {
    const selectedOwner = repoData.find((item) => item.owner === owner);
    return selectedOwner ? selectedOwner.repositories : [];
  }, [repoData, owner]);

  async function loadRepoOptions() {
    try {
      const data = await fetchRepoOptions();
      setRepoData(data);

      if (data.length > 0) {
        const defaultOwner = data[0].owner;
        const defaultRepo = data[0].repositories[0] || "";

        setOwner(defaultOwner);
        setRepo(defaultRepo);

        if (defaultOwner && defaultRepo) {
          await loadDashboard(defaultOwner, defaultRepo);
        }
      }
    } catch (error) {
      setErrorMessage("Failed to load repository options.");
    }
  }

  async function loadDashboard(selectedOwner, selectedRepo) {
    if (!selectedOwner || !selectedRepo) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSelectedScan(null);

    try {
      const [summaryData, scansData] = await Promise.all([
        fetchDashboardSummary(selectedOwner, selectedRepo),
        fetchRepoScans(selectedOwner, selectedRepo)
      ]);

      setSummary(summaryData);
      setScans(scansData);
    } catch (error) {
      setSummary(null);
      setScans([]);
      setSelectedScan(null);
      setErrorMessage(
        "Failed to load dashboard data. Please check the selected owner and repository."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleView(runId) {
    console.log("View button clicked:", runId);

    try {
      const detail = await fetchScanDetail(runId);
      console.log("Fetched scan detail:", detail);
      setSelectedScan(detail);
    } catch (error) {
      console.error("Failed to load scan detail:", error);
      setErrorMessage("Failed to load scan detail.");
    }
  }
  useEffect(() => {
    loadRepoOptions();
  }, []);

  function handleOwnerChange(selectedOwner) {
    setOwner(selectedOwner);

    const selectedOwnerData = repoData.find(
      (item) => item.owner === selectedOwner
    );

    const firstRepo = selectedOwnerData?.repositories?.[0] || "";
    setRepo(firstRepo);
  }

  function handleRepoChange(selectedRepo) {
    setRepo(selectedRepo);
  }

  function handleSubmit(event) {
    event.preventDefault();
    loadDashboard(owner, repo);
  }

  return (
    <div className="app-container">
      <header className="page-header">
        <h1>Cloud DevSecOps Security Advisor</h1>
        <p>Automated Security Scanning Dashboard</p>
      </header>

      <RepoForm
        owner={owner}
        repo={repo}
        ownerOptions={ownerOptions}
        repoOptions={repoOptions}
        onOwnerChange={handleOwnerChange}
        onRepoChange={handleRepoChange}
        onSubmit={handleSubmit}
      />

      {loading && <p className="status-message">Loading dashboard...</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {!loading && !errorMessage && summary && (
        <>
          <OverviewCards summary={summary} />
          <LatestScanDetails summary={summary} />
          {summary.simulatedGitHubComment && (
            <section className="github-comment">
              <h2>Simulated GitHub PR Comment</h2>
              <pre>{summary.simulatedGitHubComment}</pre>
            </section>
          )}
          <VulnerabilityTable
            vulnerabilities={summary.prioritizedVulnerabilities}
          />
          

          {selectedScan && (
            <section className="detail-panel">
              <h2>Scan Detail</h2>
              <div className="detail-grid">
                <p><strong>Run ID:</strong> {selectedScan.runId}</p>
                <p><strong>Scan Type:</strong> {selectedScan.scanType}</p>
                <p><strong>Status:</strong> {selectedScan.status}</p>
                <p><strong>Timestamp:</strong> {selectedScan.timestamp}</p>
                <p><strong>Branch:</strong> {selectedScan.branch}</p>
                <p><strong>Commit SHA:</strong> {selectedScan.commitSha}</p>
                <p><strong>Tool:</strong> {selectedScan.toolName}</p>
                <p><strong>Tool Version:</strong> {selectedScan.toolVersion}</p>
                <p><strong>Risk Score:</strong> {selectedScan.riskScore}</p>
                <p><strong>Total Findings:</strong> {selectedScan.totalFindings}</p>
                <p><strong>Report Format:</strong> {selectedScan.reportFormat}</p>
                <p><strong>S3 Report Path:</strong> {selectedScan.reportS3Key || "N/A"}</p>
                <button
                  style={{ marginLeft: "10px" }}
                  onClick={() => navigator.clipboard.writeText(selectedScan.reportS3Key)}
                >
                  Copy
                </button>

              </div>

              <h3>Severity Counts</h3>
              <pre>{JSON.stringify(selectedScan.severityCounts || {}, null, 2)}</pre>

              <h3>Top Findings</h3>
              <pre>{JSON.stringify(selectedScan.topFindings || [], null, 2)}</pre>
            </section>
          )}

          <ScanHistoryTable scans={scans} onView={handleView} />
        </>
      )}
    </div>
  );
}

export default App;