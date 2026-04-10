import axios from "axios";

// Local dev: omit VITE_API_URL or set http://localhost:3000
// Production build: VITE_API_URL=http://your-alb-dns.region.elb.amazonaws.com npm run build
const apiBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
);
const api = axios.create({
  baseURL: apiBaseUrl
});

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
  const response = await api.get(`/scan/${runId}`);
  return response.data.data;
}
