import axios from 'axios';

/**
 * Resolves and normalizes the base API URL from environment configuration or browser context.
 * Guarantees that the returned URL ends with '/api' (e.g. 'http://localhost:8000/api').
 * @returns {string}
 */
export const getBaseURL = () => {
  let url = import.meta.env?.VITE_API_BASE_URL;
  if (!url) {
    if (typeof window !== 'undefined') {
      url = `${window.location.protocol}//${window.location.hostname}:8000/api`;
    } else {
      url = 'http://localhost:8000/api';
    }
  }
  url = url.trim().replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
};

/**
 * Resolves the root backend server URL (without /api suffix) for health/status probes.
 * @returns {string}
 */
export const getRootURL = () => {
  const base = getBaseURL();
  return base.replace(/\/api\/?$/, '');
};

/**
 * Standardized API Error structure for frontend error handling.
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number|null} [status=null]
   * @param {any} [data=null]
   * @param {string|null} [url=null]
   */
  constructor(message, status = null, data = null, url = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.url = url;
    this.isNetworkError = !status;
    this.isTimeout = message?.toLowerCase().includes('timeout');
  }
}

/**
 * Configured Axios instance with standard timeouts and headers
 */
export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Response interceptor for consistent diagnostic logging and error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error?.config?.url || 'unknown';
    const status = error?.response?.status || null;
    const responseData = error?.response?.data || null;
    const message =
      responseData?.detail ||
      responseData?.message ||
      error.message ||
      'An unexpected error occurred while communicating with the JanDrishti API.';

    console.warn(
      `[JanDrishti API Error] ${error.config?.method?.toUpperCase() || 'GET'} ${url} -> ${
        status || 'Network/Timeout Error'
      }: ${message}`
    );

    const apiError = new ApiError(message, status, responseData, url);
    return Promise.reject(apiError);
  }
);

/* ==========================================================================
   Core API Endpoints
   ========================================================================== */

/**
 * 1. Health Probe Endpoint (GET /health)
 */
export async function getHealth(timeout = 8000) {
  const start = performance.now();
  try {
    const rootUrl = getRootURL();
    const response = await axios.get(`${rootUrl}/health`, { timeout });
    const latency = Math.round(performance.now() - start);

    return {
      status: response.data?.status || 'healthy',
      latencyMs: latency,
      isOnline: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    return {
      status: 'unavailable',
      latencyMs: latency,
      isOnline: false,
      error: error?.message || 'Backend service unreachable',
      timestamp: new Date().toISOString(),
    };
  }
}

export const checkHealth = getHealth;

/**
 * 2. Dashboard Analytics Summary (GET /api/dashboard)
 */
export async function getDashboard() {
  const response = await api.get('/dashboard');
  return response.data;
}

export const fetchDashboard = getDashboard;
export const fetchDashboardSummary = getDashboard;

/**
 * 3. Paginated Works Explorer (GET /api/works)
 */
export async function getWorks(params = {}) {
  const cleanParams = {};

  if (params.page !== undefined && params.page !== null && params.page !== '') {
    cleanParams.page = Number(params.page);
  }
  if (params.limit !== undefined && params.limit !== null && params.limit !== '') {
    cleanParams.limit = Number(params.limit);
  }
  if (typeof params.constituency === 'string' && params.constituency.trim()) {
    cleanParams.constituency = params.constituency.trim();
  }
  if (typeof params.state === 'string' && params.state.trim()) {
    cleanParams.state = params.state.trim();
  }
  if (
    typeof params.category === 'string' &&
    params.category.trim() &&
    params.category.trim() !== 'All'
  ) {
    cleanParams.category = params.category.trim();
  }
  if (typeof params.mp_name === 'string' && params.mp_name.trim()) {
    cleanParams.mp_name = params.mp_name.trim();
  }
  if (typeof params.search === 'string' && params.search.trim()) {
    cleanParams.search = params.search.trim();
  }

  const response = await api.get('/works', { params: cleanParams });
  return response.data;
}

export const fetchWorks = getWorks;

/**
 * 4. Single Work Item Detail (GET /api/works/{work_id})
 */
export async function getWorkById(workId) {
  if (workId === undefined || workId === null || workId === '') {
    throw new ApiError('workId is required to fetch work details', 400);
  }
  const response = await api.get(`/works/${encodeURIComponent(String(workId).trim())}`);
  return response.data;
}

export const fetchWorkById = getWorkById;
export const getWork = getWorkById;

/**
 * 5. Paginated MP Financial Summaries (GET /api/mps)
 */
export async function getMPs(params = {}) {
  const cleanParams = {};

  if (params.page !== undefined && params.page !== null && params.page !== '') {
    cleanParams.page = Number(params.page);
  }
  if (params.limit !== undefined && params.limit !== null && params.limit !== '') {
    cleanParams.limit = Number(params.limit);
  }
  if (typeof params.constituency === 'string' && params.constituency.trim()) {
    cleanParams.constituency = params.constituency.trim();
  }
  if (typeof params.state === 'string' && params.state.trim()) {
    cleanParams.state = params.state.trim();
  }
  if (
    typeof params.house === 'string' &&
    params.house.trim() &&
    params.house.trim() !== 'All'
  ) {
    cleanParams.house = params.house.trim();
  }
  if (typeof params.search === 'string' && params.search.trim()) {
    cleanParams.search = params.search.trim();
  } else if (typeof params.searchQuery === 'string' && params.searchQuery.trim()) {
    cleanParams.search = params.searchQuery.trim();
  } else if (typeof params.q === 'string' && params.q.trim()) {
    cleanParams.search = params.q.trim();
  }

  const response = await api.get('/mps', { params: cleanParams });
  return response.data;
}

export const fetchMPs = getMPs;

/**
 * 6. Single MP Financial Summary (GET /api/mps/{mp_id})
 */
export async function getMPById(mpId) {
  if (mpId === undefined || mpId === null || mpId === '') {
    throw new ApiError('mpId is required to fetch MP details', 400);
  }
  const response = await api.get(`/mps/${encodeURIComponent(String(mpId).trim())}`);
  return response.data;
}

export const fetchMPById = getMPById;
export const getMP = getMPById;

/**
 * 7. Canonical AI Investigation Agent (POST /api/investigate/{work_id})
 * Triggers full 8-tool AI agent investigation on target work item.
 */
export async function runAIInvestigation(workId) {
  if (workId === undefined || workId === null || workId === '') {
    throw new ApiError('workId is required to run AI investigation', 400);
  }
  const response = await api.post(`/investigate/${encodeURIComponent(String(workId).trim())}`);
  return response.data;
}

/**
 * 8. Investigation Tools List (GET /api/investigate/tools)
 */
export async function fetchInvestigationTools() {
  const response = await api.get('/investigate/tools');
  return response.data;
}

/**
 * 9. Risk Summary (GET /api/risk/summary)
 */
export async function fetchRiskSummary() {
  const response = await api.get('/risk/summary');
  return response.data;
}

/**
 * 9.5. City Risk Evaluations (GET /api/risk/cities)
 */
export async function fetchCityRisks() {
  const response = await api.get('/risk/cities');
  return response.data;
}

export const getCityRisks = fetchCityRisks;

/**
 * 10. Risk Work Detail (GET /api/risk/works/{work_id})
 */
export async function fetchWorkDetail(workId) {
  if (workId === undefined || workId === null || workId === '') {
    throw new ApiError('workId is required', 400);
  }
  const response = await api.get(`/risk/works/${encodeURIComponent(String(workId).trim())}`);
  return response.data;
}

/**
 * 11. Agency Benchmarks (GET /api/risk/benchmarks)
 */
export async function fetchAgencyBenchmarks() {
  const response = await api.get('/risk/benchmarks');
  return response.data;
}

/**
 * 12. Alerts (GET /api/alerts, PATCH /api/alerts/{id})
 */
export async function fetchAlerts(params = {}) {
  const response = await api.get('/alerts', { params });
  return response.data;
}

export async function updateAlertStatus(alertId, payload) {
  const response = await api.patch(`/alerts/${encodeURIComponent(alertId)}`, payload);
  return response.data;
}

/**
 * 13. Audit Logs (GET /api/audit/logs)
 */
export async function fetchAuditLogs(limit = 50) {
  const response = await api.get('/audit/logs', { params: { limit } });
  return response.data;
}

/**
 * 14. Dataset Stats (GET /api/dataset/stats)
 */
export async function fetchDatasetStats() {
  const response = await api.get('/dataset/stats');
  return response.data;
}

/**
 * 15. Ingestion Sync (POST /api/sync)
 */
export async function triggerSync(options = {}) {
  const params = {};
  if (options.constituency) params.constituency = options.constituency;
  if (options.state) params.state = options.state;
  if (options.max_pages) params.max_pages = options.max_pages;

  const response = await api.post('/sync', null, { params });
  return response.data;
}

/**
 * 16. Trend Intelligence (GET /api/trends/summary, GET /api/trends/completion)
 */
export async function fetchTrendSummary(params = {}) {
  const response = await api.get('/trends/summary', { params });
  return response.data;
}

export async function fetchCompletionTrend(params = {}) {
  const response = await api.get('/trends/completion', { params });
  return response.data;
}

export default api;
