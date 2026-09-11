import axios from 'axios';

// Connect directly to FastAPI backend
const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }
  return 'http://localhost:8000/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchRiskSummary = async () => {
  const res = await api.get('/risk/summary');
  return res.data;
};

export const fetchRiskWorks = async (params = {}) => {
  const res = await api.get('/risk/works', { params });
  return res.data;
};

export const fetchWorkDetail = async (workId) => {
  const res = await api.get(`/risk/works/${workId}`);
  return res.data;
};

export const fetchMPs = async (params = {}) => {
  const res = await api.get('/mps', { params });
  return res.data;
};

export const fetchAlerts = async (params = {}) => {
  const res = await api.get('/alerts', { params });
  return res.data;
};

export const updateAlertStatus = async (alertId, payload) => {
  const res = await api.patch(`/alerts/${alertId}`, payload);
  return res.data;
};

export const runAIInvestigation = async (workId) => {
  const res = await api.post('/investigate/brief', { work_id: String(workId) });
  return res.data;
};

export const triggerSync = async (params = {}) => {
  const res = await api.post('/sync', null, { params });
  return res.data;
};

export const triggerLiveSync = async (constituency = 'SHAHJAHANPUR', limit = 100) => {
  const res = await api.post(`/sync?constituency=${encodeURIComponent(constituency)}&max_pages=5`);
  return res.data;
};

export const triggerCsvLoad = async (maxRecords = 200, constituency = null) => {
  const params = { max_records: maxRecords };
  if (constituency) params.constituency = constituency;
  const res = await api.post('/dataset/load-csv', null, { params });
  return res.data;
};

export const fetchAgencyBenchmarks = async () => {
  const res = await api.get('/risk/benchmarks');
  return res.data;
};

export const fetchAuditLogs = async (params = {}) => {
  const res = await api.get('/audit/logs', { params });
  return res.data;
};

export const fetchDatasetStats = async () => {
  const res = await api.get('/dataset/stats');
  return res.data;
};

export default api;
