import api from './api';

export async function fetchRiskSummary() {
  const response = await api.get('/risk/summary');
  return response.data;
}

export async function fetchAgencyBenchmarks() {
  const response = await api.get('/risk/benchmarks');
  return response.data;
}

export async function fetchAlerts(params = {}) {
  const response = await api.get('/alerts', { params });
  return response.data;
}

export async function fetchWorkDetail(workId) {
  const response = await api.get(`/risk/works/${encodeURIComponent(workId)}`);
  return response.data;
}

export async function fetchAuditLogs(limit = 50) {
  const response = await api.get('/audit/logs', { params: { limit } });
  return response.data;
}

export async function runAIInvestigation(workId) {
  const response = await api.post('/investigate/brief', { work_id: String(workId) });
  return response.data;
}

