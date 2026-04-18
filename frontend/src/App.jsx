import { useEffect, useMemo, useRef, useState } from "react";
import RepoForm from "./components/RepoForm";
import OverviewCards from "./components/OverviewCards";
import LatestScanDetails from "./components/LatestScanDetails";
import VulnerabilityTable from "./components/VulnerabilityTable";
import PentestControl from "./components/PentestControl";
import PentestResultsPanel from "./components/PentestResultsPanel";
import {
  fetchDashboardSummary,
  fetchPentestSchedule,
  fetchRepoOptions,
  fetchRepoScans,
  fetchScanDetail,
  triggerPentestNow,
  updatePentestSchedule,
} from "./services/api";
import "./index.css";

const TARGET_URL_SESSION_KEY = "advisor.pentest.targetUrl";
const SELECTED_OWNER_SESSION_KEY = "advisor.selected.owner";
const SELECTED_REPO_SESSION_KEY = "advisor.selected.repo";
const PENTEST_SCHEDULES_BY_REPO_SESSION_KEY = "advisor.pentest.schedulesByRepo";
const PENTEST_TARGETS_BY_REPO_SESSION_KEY = "advisor.pentest.targetsByRepo";
const DEFAULT_SCHEDULE_EXPRESSION = "none";
const DASHBOARD_TABS = {
  PROJECT: "project",
  TOTAL_RISK: "total-risk",
  SAST: "sast",
  PENTEST: "pentest",
};

function App() {
  const [targetUrl, setTargetUrl] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.sessionStorage.getItem(TARGET_URL_SESSION_KEY) || "";
  });
  const [pentestRepoName, setPentestRepoName] = useState("");
  const [scheduleExpression, setScheduleExpression] = useState(
    DEFAULT_SCHEDULE_EXPRESSION,
  );
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
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState(DASHBOARD_TABS.PROJECT);
  const [findingSearch, setFindingSearch] = useState("");
  const [findingSeverityFilter, setFindingSeverityFilter] = useState("all");
  const [pentestScanDetail, setPentestScanDetail] = useState(null);
  const [pentestScanDetailLoading, setPentestScanDetailLoading] =
    useState(false);
  const latestDashboardRequestRef = useRef(0);
  const latestPentestConfigRequestRef = useRef(0);
  const latestPentestDetailRequestRef = useRef(0);

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

    const schedulesByRepo = readJsonSessionObject(
      PENTEST_SCHEDULES_BY_REPO_SESSION_KEY,
    );
    schedulesByRepo[normalizedRepo] =
      String(schedule || "").trim() || DEFAULT_SCHEDULE_EXPRESSION;
    writeJsonSessionObject(
      PENTEST_SCHEDULES_BY_REPO_SESSION_KEY,
      schedulesByRepo,
    );

    const normalizedTarget = String(target || "").trim();
    if (normalizedTarget) {
      const targetsByRepo = readJsonSessionObject(
        PENTEST_TARGETS_BY_REPO_SESSION_KEY,
      );
      targetsByRepo[normalizedRepo] = normalizedTarget;
      writeJsonSessionObject(
        PENTEST_TARGETS_BY_REPO_SESSION_KEY,
        targetsByRepo,
      );
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

  async function waitForPentestCompletion(
    selectedOwner,
    selectedRepo,
    startedAtMs,
  ) {
    const maxAttempts = 24;
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
          `Pentest is running... checking for results (${attempt}/${maxAttempts})`,
        );
        await sleep(pollIntervalMs);
      }
    }

    return false;
  }

  const ownerOptions = useMemo(
    () => repoData.map((item) => item.owner),
    [repoData],
  );

  const existingProjects = useMemo(() => {
    return repoData.flatMap((item) =>
      (item.repositories || []).map((repositoryName) => ({
        owner: item.owner,
        repo: repositoryName,
        label: `${item.owner}/${repositoryName}`,
      })),
    );
  }, [repoData]);

  const repoOptions = useMemo(() => {
    const selectedOwner = repoData.find((item) => item.owner === owner);
    return selectedOwner ? selectedOwner.repositories : [];
  }, [repoData, owner]);

  const filteredSummary = useMemo(() => {
    if (!summary) return null;

    if (activeTab === DASHBOARD_TABS.TOTAL_RISK) {
      return summary;
    }

    if (activeTab === DASHBOARD_TABS.SAST) {
      return {
        ...summary,
        latestPentest: null,
        prioritizedVulnerabilities:
          summary.prioritizedVulnerabilities?.filter(
            (v) => String(v.source || "").toUpperCase() === "SAST",
          ) || [],
      };
    }

    if (activeTab === DASHBOARD_TABS.PENTEST) {
      return {
        ...summary,
        latestSast: null,
        prioritizedVulnerabilities:
          summary.prioritizedVulnerabilities?.filter(
            (v) => String(v.source || "").toUpperCase() === "PENTEST",
          ) || [],
      };
    }

    return summary;
  }, [summary, activeTab]);

  const visibleVulnerabilities = useMemo(() => {
    const vulnerabilities = filteredSummary?.prioritizedVulnerabilities || [];
    const query = findingSearch.trim().toLowerCase();
    const selectedSeverity = String(
      findingSeverityFilter || "all",
    ).toLowerCase();

    return vulnerabilities.filter((item) => {
      const titleMatches = query
        ? String(item.title || "")
            .toLowerCase()
            .includes(query)
        : true;
      const severityMatches =
        selectedSeverity === "all"
          ? true
          : String(item.severity || "").toLowerCase() === selectedSeverity;

      return titleMatches && severityMatches;
    });
  }, [filteredSummary, findingSearch, findingSeverityFilter]);

  const latestVisibleScan = useMemo(() => {
    if (!filteredSummary) {
      return null;
    }

    if (activeTab === DASHBOARD_TABS.SAST) {
      return filteredSummary.latestSast || null;
    }

    if (activeTab === DASHBOARD_TABS.TOTAL_RISK) {
      return (
        filteredSummary.latestSast || filteredSummary.latestPentest || null
      );
    }

    if (activeTab === DASHBOARD_TABS.PENTEST) {
      return filteredSummary.latestPentest || null;
    }

    return filteredSummary.latestSast || filteredSummary.latestPentest || null;
  }, [filteredSummary, activeTab]);

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

    try {
      const summaryData = await fetchDashboardSummary(
        selectedOwner,
        selectedRepo,
      );

      if (requestId !== latestDashboardRequestRef.current) {
        return;
      }

      setSummary(summaryData);
    } catch (error) {
      if (requestId !== latestDashboardRequestRef.current) {
        return;
      }

      setSummary(null);
      setErrorMessage(
        "Failed to load dashboard data. Please check the selected owner and repository.",
      );
    } finally {
      if (requestId === latestDashboardRequestRef.current) {
        setLoading(false);
      }
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

      const cachedSchedulesByRepo = readJsonSessionObject(
        PENTEST_SCHEDULES_BY_REPO_SESSION_KEY,
      );
      const cachedTargetsByRepo = readJsonSessionObject(
        PENTEST_TARGETS_BY_REPO_SESSION_KEY,
      );

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
            config.targetUrl || "",
          );
        } else {
          setScheduleExpression(DEFAULT_SCHEDULE_EXPRESSION);
        }
      } catch (error) {
        if (requestId !== latestPentestConfigRequestRef.current) {
          return;
        }
        console.warn(
          "Failed to load pentest schedule config:",
          error?.message || error,
        );
      }
    }

    loadSelectedRepoPentestConfig();
  }, [owner, repo]);

  useEffect(() => {
    async function loadPentestScanDetail() {
      if (activeTab !== DASHBOARD_TABS.PENTEST) {
        setPentestScanDetail(null);
        setPentestScanDetailLoading(false);
        return;
      }

      const runId = latestVisibleScan?.runId;
      if (!runId) {
        setPentestScanDetail(null);
        setPentestScanDetailLoading(false);
        return;
      }

      const requestId = ++latestPentestDetailRequestRef.current;
      setPentestScanDetailLoading(true);

      try {
        const detail = await fetchScanDetail(runId);
        if (requestId !== latestPentestDetailRequestRef.current) {
          return;
        }
        setPentestScanDetail(detail || null);
      } catch (error) {
        if (requestId !== latestPentestDetailRequestRef.current) {
          return;
        }
        setPentestScanDetail(null);
      } finally {
        if (requestId === latestPentestDetailRequestRef.current) {
          setPentestScanDetailLoading(false);
        }
      }
    }

    loadPentestScanDetail();
  }, [activeTab, latestVisibleScan?.runId]);

  function handleOwnerChange(selectedOwner) {
    setOwner(selectedOwner);

    const selectedOwnerData = repoData.find(
      (item) => item.owner === selectedOwner,
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
        throw new Error(
          "Please enter a valid target URL before running pentest.",
        );
      }
      const repoName =
        String(pentestRepoName || "").trim() || `${owner}/${repo}`;
      const startedAtMs = Date.now();
      await triggerPentestNow({
        targetUrl,
        repoName,
      });
      setPentestProgressMessage(
        "Request accepted. Waiting for pentest result...",
      );
      const finished = await waitForPentestCompletion(owner, repo, startedAtMs);
      await loadDashboard(owner, repo);
      if (finished) {
        setPentestActionMessage(
          "Pentest finished. Dashboard has been refreshed.",
        );
      } else {
        setPentestActionMessage(
          "Pentest request was accepted, but result is taking longer than expected. Check scan history shortly.",
        );
      }
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
          error.message ||
          "Failed to trigger pentest.",
      );
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
        throw new Error(
          "Please enter a valid target URL before saving schedule.",
        );
      }
      const repoName =
        String(pentestRepoName || "").trim() || `${owner}/${repo}`;
      await updatePentestSchedule({
        targetUrl,
        repoName,
        scheduleExpression,
      });
      cachePentestSettingsForRepo(repoName, scheduleExpression, targetUrl);
      setPentestActionMessage("Pentest schedule updated successfully.");
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
          error.message ||
          "Failed to update schedule.",
      );
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

  function handleTabChange(nextTab) {
    setActiveTab(nextTab);
  }

  function handleDownloadFindings() {
    const payload = JSON.stringify(visibleVulnerabilities, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prioritized-vulnerabilities.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <div className="page-orb page-orb-one" aria-hidden="true" />
      <div className="page-orb page-orb-two" aria-hidden="true" />

      <div className="app-container">
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
              <p className="status-message">
                Please wait. This may take a few seconds.
              </p>
            </div>
          </div>
        )}

        <main className="dashboard-layout">
          <aside className="dashboard-sidebar">
            <header className="hero-panel sidebar-hero-panel">
              <div className="hero-copy">
                <h1>Cloud DevSecOps Security Advisor</h1>
                <p className="hero-description">
                  A cleaner command center for automated code scans, API
                  pentests, and prioritized remediation across every repository.
                </p>
                <div className="hero-badges" aria-label="Core capabilities">
                  <span className="hero-badge">SAST CODE SCANNING</span>
                  <span className="hero-badge">API PENTESTING</span>
                  <span className="hero-badge">SCAN HISTORY</span>
                  <span className="hero-badge">RISK SCORE</span>
                </div>
              </div>
            </header>

            <nav className="sidebar-tabs" aria-label="Dashboard sections">
              <button
                type="button"
                className={`sidebar-tab ${activeTab === DASHBOARD_TABS.PROJECT ? "active" : ""}`}
                onClick={() => handleTabChange(DASHBOARD_TABS.PROJECT)}
              >
                Project
              </button>
              <button
                type="button"
                className={`sidebar-tab ${activeTab === DASHBOARD_TABS.TOTAL_RISK ? "active" : ""}`}
                onClick={() => handleTabChange(DASHBOARD_TABS.TOTAL_RISK)}
              >
                Total Risk Score
              </button>
              <button
                type="button"
                className={`sidebar-tab ${activeTab === DASHBOARD_TABS.SAST ? "active" : ""}`}
                onClick={() => handleTabChange(DASHBOARD_TABS.SAST)}
              >
                SAST Result
              </button>
              <button
                type="button"
                className={`sidebar-tab ${activeTab === DASHBOARD_TABS.PENTEST ? "active" : ""}`}
                onClick={() => handleTabChange(DASHBOARD_TABS.PENTEST)}
              >
                Pentest Control and Result
              </button>
            </nav>

            <div className="status-stack sidebar-status" aria-live="polite">
              {pentestActionMessage && (
                <p className="status-message">{pentestActionMessage}</p>
              )}
              {loading && (
                <p className="status-message">Loading dashboard...</p>
              )}
              {errorMessage && <p className="error-message">{errorMessage}</p>}
            </div>
          </aside>

          <section className="dashboard-content">
            {!errorMessage && summary && (
              <section className="results-panel">
                {activeTab === DASHBOARD_TABS.PROJECT && (
                  <>
                    <div className="project-layout">
                      <RepoForm
                        owner={owner}
                        repo={repo}
                        targetUrl={targetUrl}
                        ownerOptions={ownerOptions}
                        repoOptions={repoOptions}
                        onOwnerChange={handleOwnerChange}
                        onRepoChange={handleRepoChange}
                        onTargetUrlChange={setTargetUrl}
                        onSubmit={handleSubmit}
                      />

                      <aside className="existing-project-card">
                        <div className="section-heading compact-heading">
                          <div>
                            <h3>Current project</h3>
                            <p className="section-description">
                              This is the project currently loaded in the
                              dashboard.
                            </p>
                          </div>
                        </div>

                        <div className="existing-project-summary">
                          <p>
                            <strong>Owner:</strong> {owner || "N/A"}
                          </p>
                          <p>
                            <strong>Repository:</strong> {repo || "N/A"}
                          </p>
                          <p>
                            <strong>Target URL:</strong> {targetUrl || "N/A"}
                          </p>
                          <p>
                            <strong>Repo label:</strong>{" "}
                            {pentestRepoName || "N/A"}
                          </p>
                        </div>

                        <div className="existing-project-list">
                          {existingProjects.length ? (
                            existingProjects.slice(0, 8).map((project) => (
                              <div
                                key={project.label}
                                className={`existing-project-item ${project.owner === owner && project.repo === repo ? "active" : ""}`}
                              >
                                <span>{project.label}</span>
                              </div>
                            ))
                          ) : (
                            <p className="status-message">
                              No existing projects found.
                            </p>
                          )}
                        </div>
                      </aside>
                    </div>
                  </>
                )}

                {activeTab === DASHBOARD_TABS.TOTAL_RISK && (
                  <>
                    <div className="results-header">
                      <div>
                        <h2>Total risk score</h2>
                        <p className="section-description">
                          View the combined risk score for the current project.
                        </p>
                      </div>

                      <div className="results-chip-row">
                        <span className="results-chip">
                          <strong>Overall score</strong>
                          <span>
                            {filteredSummary?.overallRiskScore ?? "N/A"}
                          </span>
                        </span>
                        <span className="results-chip">
                          <strong>Findings</strong>
                          <span>
                            {filteredSummary?.prioritizedVulnerabilities
                              ?.length ?? 0}
                          </span>
                        </span>
                      </div>
                    </div>

                    <OverviewCards summary={filteredSummary} />
                    <VulnerabilityTable
                      vulnerabilities={visibleVulnerabilities}
                      isLoading={loading}
                      onDownload={handleDownloadFindings}
                    />
                  </>
                )}

                {activeTab === DASHBOARD_TABS.SAST && (
                  <>
                    <div className="results-header">
                      <div>
                        <h2>Latest SAST scan</h2>
                      </div>
                    </div>

                    <section className="sast-top-row">
                      <LatestScanDetails summary={filteredSummary} />

                      <OverviewCards summary={filteredSummary} variant="sast" />
                    </section>

                    <div className="results-toolbar">
                      <div className="results-search">
                        <input
                          type="search"
                          value={findingSearch}
                          onChange={(event) =>
                            setFindingSearch(event.target.value)
                          }
                          placeholder="Filter by title..."
                          aria-label="Filter SAST vulnerabilities by title"
                        />
                      </div>
                      <div className="results-severity-filter">
                        <label htmlFor="sast-severity-filter">Severity</label>
                        <select
                          id="sast-severity-filter"
                          value={findingSeverityFilter}
                          onChange={(event) =>
                            setFindingSeverityFilter(event.target.value)
                          }
                          aria-label="Filter SAST vulnerabilities by severity"
                        >
                          <option value="all">All</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>

                    <VulnerabilityTable
                      vulnerabilities={visibleVulnerabilities}
                      isLoading={loading}
                      onDownload={handleDownloadFindings}
                    />
                  </>
                )}

                {activeTab === DASHBOARD_TABS.PENTEST && (
                  <>
                    <div className="results-header">
                      <div>
                        <h2>Pentest schedule and result</h2>
                        <p className="section-description">
                          Configure the pentest schedule, run it now, and review
                          the latest pentest result.
                        </p>
                      </div>

                      <div className="results-chip-row">
                        <span className="results-chip">
                          <strong>Scan ID</strong>
                          <span>{latestVisibleScan?.runId ?? "N/A"}</span>
                        </span>
                        <span className="results-chip">
                          <strong>Total</strong>
                          <span>
                            {latestVisibleScan?.totalFindings ??
                              visibleVulnerabilities.length}
                          </span>
                        </span>
                      </div>
                    </div>

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

                    <PentestResultsPanel
                      scanSummary={latestVisibleScan}
                      scanDetail={pentestScanDetail}
                      loading={pentestScanDetailLoading}
                    />
                    <LatestScanDetails summary={filteredSummary} />
                  </>
                )}
              </section>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
