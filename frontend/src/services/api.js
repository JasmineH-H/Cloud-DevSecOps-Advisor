import axios from "axios";

// Local dev: omit VITE_API_URL or set http://localhost:3000
// Production build: VITE_API_URL=http://your-alb-dns.region.elb.amazonaws.com npm run build
function normalizeApiUrl(url) {
  return (url || "").trim().replace(/\/+$/, "");
}

const defaultApiBaseUrl = normalizeApiUrl(
  import.meta.env.VITE_API_URL || "http://localhost:3000"
);

const api = axios.create({
  baseURL: defaultApiBaseUrl
});

export function getApiBaseUrl() {
  return api.defaults.baseURL;
}

export function setApiBaseUrl(url) {
  const normalizedUrl = normalizeApiUrl(url);
  if (!normalizedUrl) {
    throw new Error("API URL is required.");
  }
  api.defaults.baseURL = normalizedUrl;
}

export async function fetchRepoOptions() {
  const response = await api.get("/repos");
  return response.data.data;
}

export async function fetchDashboardSummary(owner, repo) {
  const response = await api.get(`/repos/${owner}/${repo}/dashboard-summary`);
  return response.data.data;
}

export async function fetchRepoScans(owner, repo) {
  const response = await api.get(`/repos/${owner}/${repo}/scans`);
  return response.data.data;
}

export async function fetchScanDetail(runId) {
  const response = await api.get("/scan", {
    params: { runId }
  });
  return response.data.data;
}

export async function fetchScanFindings(runId, filters = {}) {
  const response = await api.get(`/scan/${runId}/findings`, {
    params: {
      severity: filters.severity || undefined,
      title: filters.title || undefined
    }
  });
  return response.data.data;
}

export async function triggerPentestNow({ targetUrl, repoName }) {
  const response = await api.post("/pentest/run-now", {
    targetUrl,
    repoName
  });
  return response.data;
}

export async function updatePentestSchedule({
  targetUrl,
  repoName,
  scheduleExpression
}) {
  const response = await api.post("/pentest/schedule", {
    targetUrl,
    repoName,
    scheduleExpression
  });
  return response.data;
}

export async function fetchPentestSchedule(repoName) {
  const response = await api.get("/pentest/schedule", {
    params: { repoName }
  });
  return response.data.data;
}
