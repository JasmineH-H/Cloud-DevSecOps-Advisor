import { useEffect, useMemo, useRef, useState } from "react";
import RepoForm from "./components/RepoForm";
import OverviewCards from "./components/OverviewCards";
import LatestScanDetails from "./components/LatestScanDetails";
import VulnerabilityTable from "./components/VulnerabilityTable";
import ScanHistoryTable from "./components/ScanHistoryTable";
import PentestControl from "./components/PentestControl";
import {
  fetchDashboardSummary,
  fetchPentestSchedule,
  fetchRepoOptions,
  fetchRepoScans,
  fetchScanDetail,
  triggerPentestNow,
  updatePentestSchedule
} from "./services/api";
import "./index.css";

const TARGET_URL_SESSION_KEY = "advisor.pentest.targetUrl";
const SELECTED_OWNER_SESSION_KEY = "advisor.selected.owner";
const SELECTED_REPO_SESSION_KEY = "advisor.selected.repo";
const PENTEST_SCHEDULES_BY_REPO_SESSION_KEY = "advisor.pentest.schedulesByRepo";
const PENTEST_TARGETS_BY_REPO_SESSION_KEY = "advisor.pentest.targetsByRepo";
const DEFAULT_SCHEDULE_EXPRESSION = "cron(0 2 * * ? *)";

function App() {
  const [targetUrl, setTargetUrl] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.sessionStorage.getItem(TARGET_URL_SESSION_KEY) || "";
  });
  const [pentestRepoName, setPentestRepoName] = useState("");
  const [scheduleExpression, setScheduleExpression] = useState(DEFAULT_SCHEDULE_EXPRESSION);
  const [pentestActionBusy, setPentestActionBusy] = useState(false);
  const [pentestActionType, setPentestActionType] = useState("");
  const [pentestProgressMessage, setPentestProgressMessage] = useState("");
  const [pentestActionMessage, setPentestActionMessage] = useState("");
  const [owner, setOwner] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.sessionStorage.getItem(SELECTED_OWNER_SESSION_KEY) || "";
  });
  const [repo, setRepo] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.sessionStorage.getItem(SELECTED_REPO_SESSION_KEY) || "";
  });
  const [repoData, setRepoData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const latestDashboardRequestRef = useRef(0);
  const latestPentestConfigRequestRef = useRef(0);

  function readJsonSessionObject(key) {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeJsonSessionObject(key, value) {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(key, JSON.stringify(value));
  }

  function cachePentestSettingsForRepo(repoLabel, schedule, target) {
    const normalizedRepo = String(repoLabel || "").trim();
    if (!normalizedRepo) {
      return;
    }

    const schedulesByRepo = readJsonSessionObject(PENTEST_SCHEDULES_BY_REPO_SESSION_KEY);
    schedulesByRepo[normalizedRepo] = String(schedule || "").trim() || DEFAULT_SCHEDULE_EXPRESSION;
    writeJsonSessionObject(PENTEST_SCHEDULES_BY_REPO_SESSION_KEY, schedulesByRepo);

    const normalizedTarget = String(target || "").trim();
    if (normalizedTarget) {
      const targetsByRepo = readJsonSessionObject(PENTEST_TARGETS_BY_REPO_SESSION_KEY);
      targetsByRepo[normalizedRepo] = normalizedTarget;
      writeJsonSessionObject(PENTEST_TARGETS_BY_REPO_SESSION_KEY, targetsByRepo);
    }
  }

  function isValidHttpUrl(value) {
    try {
      const parsed = new URL(String(value || "").trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function waitForPentestCompletion(selectedOwner, selectedRepo, startedAtMs) {
    const maxAttempts = 24; // about 4 minutes with 10s polling
    const pollIntervalMs = 10_000;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const scansData = await fetchRepoScans(selectedOwner, selectedRepo);
      const hasNewPentest = scansData.some((scan) => {
        if (String(scan.scanType || "").toUpperCase() !== "PENTEST") {
          return false;
        }
        const scanTimeMs = Date.parse(scan.timestamp || "");
        return !Number.isNaN(scanTimeMs) && scanTimeMs >= startedAtMs;
      });

      if (hasNewPentest) {
        return true;
      }

      if (attempt < maxAttempts) {
        setPentestProgressMessage(
          `Pentest is running... checking for results (${attempt}/${maxAttempts})`
        );
        await sleep(pollIntervalMs);
      }
    }

    return false;
  }

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
        const savedOwner =
          (typeof window !== "undefined" &&
            window.sessionStorage.getItem(SELECTED_OWNER_SESSION_KEY)) ||
          "";
        const savedRepo =
          (typeof window !== "undefined" &&
            window.sessionStorage.getItem(SELECTED_REPO_SESSION_KEY)) ||
          "";

        let defaultOwner = data[0].owner;
        let defaultRepo = data[0].repositories[0] || "";

        const savedOwnerData = data.find((item) => item.owner === savedOwner);
        if (savedOwnerData) {
          defaultOwner = savedOwner;
          if (savedRepo && savedOwnerData.repositories.includes(savedRepo)) {
            defaultRepo = savedRepo;
          } else {
            defaultRepo = savedOwnerData.repositories[0] || "";
          }
        }

        setOwner(defaultOwner);
        setRepo(defaultRepo);
        setPentestRepoName(defaultRepo ? `${defaultOwner}/${defaultRepo}` : "");

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

    const requestId = ++latestDashboardRequestRef.current;
    setLoading(true);
    setErrorMessage("");
    setSelectedScan(null);

    try {
      const [summaryData, scansData] = await Promise.all([
        fetchDashboardSummary(selectedOwner, selectedRepo),
        fetchRepoScans(selectedOwner, selectedRepo)
      ]);

      if (requestId !== latestDashboardRequestRef.current) {
        return;
      }

      setSummary(summaryData);
      setScans(scansData);
    } catch (error) {
      if (requestId !== latestDashboardRequestRef.current) {
        return;
      }

      setSummary(null);
      setScans([]);
      setSelectedScan(null);
      setErrorMessage(
        "Failed to load dashboard data. Please check the selected owner and repository."
      );
    } finally {
      if (requestId === latestDashboardRequestRef.current) {
        setLoading(false);
      }
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (owner) {
      window.sessionStorage.setItem(SELECTED_OWNER_SESSION_KEY, owner);
    } else {
      window.sessionStorage.removeItem(SELECTED_OWNER_SESSION_KEY);
    }
  }, [owner]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (repo) {
      window.sessionStorage.setItem(SELECTED_REPO_SESSION_KEY, repo);
    } else {
      window.sessionStorage.removeItem(SELECTED_REPO_SESSION_KEY);
    }
  }, [repo]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const normalized = String(targetUrl || "").trim();
    if (!normalized) {
      window.sessionStorage.removeItem(TARGET_URL_SESSION_KEY);
      return;
    }
    window.sessionStorage.setItem(TARGET_URL_SESSION_KEY, normalized);
  }, [targetUrl]);

  useEffect(() => {
    async function loadSelectedRepoPentestConfig() {
      if (!owner || !repo) {
        return;
      }
      const requestId = ++latestPentestConfigRequestRef.current;
      const repoLabel = `${owner}/${repo}`;
      setPentestRepoName(repoLabel);

       const cachedSchedulesByRepo = readJsonSessionObject(PENTEST_SCHEDULES_BY_REPO_SESSION_KEY);
       const cachedTargetsByRepo = readJsonSessionObject(PENTEST_TARGETS_BY_REPO_SESSION_KEY);
       if (cachedSchedulesByRepo[repoLabel]) {
         setScheduleExpression(String(cachedSchedulesByRepo[repoLabel]));
       } else {
         setScheduleExpression(DEFAULT_SCHEDULE_EXPRESSION);
       }
       if (cachedTargetsByRepo[repoLabel]) {
         setTargetUrl(String(cachedTargetsByRepo[repoLabel]));
       }

      try {
        const config = await fetchPentestSchedule(repoLabel);
        if (requestId !== latestPentestConfigRequestRef.current) {
          return;
        }
        if (config?.configured) {
          if (config.targetUrl) {
            setTargetUrl(String(config.targetUrl));
          }
          if (config.scheduleExpression) {
            setScheduleExpression(String(config.scheduleExpression));
          }
          if (config.repoName) {
            setPentestRepoName(String(config.repoName));
          }
          cachePentestSettingsForRepo(
            config.repoName ? String(config.repoName) : repoLabel,
            config.scheduleExpression || DEFAULT_SCHEDULE_EXPRESSION,
            config.targetUrl || ""
          );
        } else {
          setScheduleExpression(DEFAULT_SCHEDULE_EXPRESSION);
        }
      } catch (error) {
        if (requestId !== latestPentestConfigRequestRef.current) {
          return;
        }
        // Keep current value if schedule fetch fails (avoid clobbering saved UI state).
        console.warn("Failed to load pentest schedule config:", error?.message || error);
      }
    }

    loadSelectedRepoPentestConfig();
  }, [owner, repo]);

  function handleOwnerChange(selectedOwner) {
    setOwner(selectedOwner);

    const selectedOwnerData = repoData.find(
      (item) => item.owner === selectedOwner
    );

    const firstRepo = selectedOwnerData?.repositories?.[0] || "";
    setRepo(firstRepo);
    setPentestRepoName(firstRepo ? `${selectedOwner}/${firstRepo}` : "");
  }

  function handleRepoChange(selectedRepo) {
    setRepo(selectedRepo);
    setPentestRepoName(selectedRepo ? `${owner}/${selectedRepo}` : "");
  }

  async function handleRunPentestNow() {
    setPentestActionMessage("");
    setErrorMessage("");
    setPentestActionType("run-now");
    setPentestProgressMessage("Sending immediate pentest run request...");
    setPentestActionBusy(true);
    try {
      if (!owner || !repo) {
        throw new Error("Please select owner and repository first.");
      }
      if (!isValidHttpUrl(targetUrl)) {
        throw new Error("Please enter a valid target URL before running pentest.");
      }
      const repoName = String(pentestRepoName || "").trim() || `${owner}/${repo}`;
      const startedAtMs = Date.now();
      await triggerPentestNow({
        targetUrl,
        repoName
      });
      setPentestProgressMessage("Request accepted. Waiting for pentest result...");
      const finished = await waitForPentestCompletion(owner, repo, startedAtMs);
      await loadDashboard(owner, repo);
      if (finished) {
        setPentestActionMessage("Pentest finished. Dashboard has been refreshed.");
      } else {
        setPentestActionMessage(
          "Pentest request was accepted, but result is taking longer than expected. Check scan history shortly."
        );
      }
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || error.message || "Failed to trigger pentest.");
    } finally {
      setPentestActionBusy(false);
      setPentestActionType("");
      setPentestProgressMessage("");
    }
  }

  async function handleSavePentestSchedule() {
    setPentestActionMessage("");
    setErrorMessage("");
    setPentestActionType("save-schedule");
    setPentestProgressMessage("Saving scheduled pentest configuration...");
    setPentestActionBusy(true);
    try {
      if (!owner || !repo) {
        throw new Error("Please select owner and repository first.");
      }
      if (!isValidHttpUrl(targetUrl)) {
        throw new Error("Please enter a valid target URL before saving schedule.");
      }
      const repoName = String(pentestRepoName || "").trim() || `${owner}/${repo}`;
      await updatePentestSchedule({
        targetUrl,
        repoName,
        scheduleExpression
      });
      cachePentestSettingsForRepo(repoName, scheduleExpression, targetUrl);
      setPentestActionMessage("Pentest schedule updated successfully.");
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || error.message || "Failed to update schedule.");
    } finally {
      setPentestActionBusy(false);
      setPentestActionType("");
      setPentestProgressMessage("");
    }
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

      {pentestActionBusy && (
        <div className="action-overlay" role="status" aria-live="polite">
          <div className="action-overlay-card">
            <h3>Pentest Request Running</h3>
            <p>
              {pentestActionType === "save-schedule"
                ? "Saving scheduled pentest configuration..."
                : "Sending immediate pentest run request..."}
            </p>
            {pentestProgressMessage ? <p>{pentestProgressMessage}</p> : null}
            <p className="status-message">Please wait. This may take a few seconds.</p>
          </div>
        </div>
      )}

      <RepoForm
        owner={owner}
        repo={repo}
        ownerOptions={ownerOptions}
        repoOptions={repoOptions}
        onOwnerChange={handleOwnerChange}
        onRepoChange={handleRepoChange}
        onSubmit={handleSubmit}
      />

      <PentestControl
        targetUrl={targetUrl}
        scheduleExpression={scheduleExpression}
        repoName={pentestRepoName}
        busy={pentestActionBusy}
        onTargetUrlChange={setTargetUrl}
        onRepoNameChange={setPentestRepoName}
        onScheduleExpressionChange={setScheduleExpression}
        onRunNow={handleRunPentestNow}
        onSaveSchedule={handleSavePentestSchedule}
      />

      {pentestActionMessage && <p className="status-message">{pentestActionMessage}</p>}
      {loading && <p className="status-message">Loading dashboard...</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {!errorMessage && summary && (
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
            isLoading={loading}
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
                  disabled={!selectedScan.reportS3Key}
                  onClick={() => {
                    if (selectedScan.reportS3Key) {
                      navigator.clipboard.writeText(selectedScan.reportS3Key);
                    }
                  }}
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

          <ScanHistoryTable scans={scans} onView={handleView} isLoading={loading} />
        </>
      )}
    </div>
  );
}

export default App;
