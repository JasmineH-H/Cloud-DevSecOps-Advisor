import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000"
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
