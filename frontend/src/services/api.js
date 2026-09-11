import axios from 'axios';

/**
 * Resolves the base API URL from environment configuration or browser context.
 * Defaults to 'http://localhost:8000/api'.
 * @returns {string}
 */
export const getBaseURL = () => {
  if (import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }
  return 'http://localhost:8000/api';
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
   Async API Helper Functions
   ========================================================================== */

/**
 * 1. Health Probe Endpoint (GET /health)
 * Probes root backend server availability and measures round-trip latency.
 *
 * @param {number} [timeout=8000] - Probe timeout in milliseconds
 * @returns {Promise<{
 *   status: string,
 *   latencyMs: number,
 *   isOnline: boolean,
 *   timestamp: string,
 *   error?: string
 * }>}
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

/**
 * Alias for getHealth()
 */
export const checkHealth = getHealth;

/**
 * 2. Dashboard Analytics Summary (GET /api/dashboard)
 * Retrieves high-level live SQL summary aggregates from PostgreSQL records.
 *
 * @returns {Promise<{
 *   works_summary: {
 *     total_works: number,
 *     total_cost: number,
 *     average_cost: number,
 *     total_beneficiaries: number,
 *     unique_constituencies: number,
 *     unique_states: number
 *   },
 *   mps_summary: {
 *     total_mps: number,
 *     total_allocated_amount: number,
 *     total_expenditure: number,
 *     average_utilization_percentage: number,
 *     total_completed_works: number,
 *     total_recommended_works: number,
 *     total_unspent_amount: number
 *   },
 *   macro_indicators: Record<string, {
 *     metric_name: string,
 *     value_raw?: string|null,
 *     value_crores?: string|null,
 *     count?: number|null
 *   }>,
 *   data_sources: Record<string, any>
 * }>}
 */
export async function getDashboard() {
  const response = await api.get('/dashboard');
  return response.data;
}

/**
 * Alias for getDashboard()
 */
export const fetchDashboard = getDashboard;
export const fetchDashboardSummary = getDashboard;

/**
 * 3. Paginated Works Explorer (GET /api/works)
 * Retrieves paginated MPLADS works with optional filters.
 *
 * @param {Object} [params={}]
 * @param {number} [params.page=1] - Page number (1-indexed)
 * @param {number} [params.limit=20] - Number of items per page (1-100)
 * @param {string} [params.constituency] - Filter by constituency name (case-insensitive)
 * @param {string} [params.state] - Filter by state name (case-insensitive)
 * @param {string} [params.category] - Filter by work category
 * @returns {Promise<{
 *   items: Array<{
 *     id: number,
 *     work_id?: number|null,
 *     source_id?: string|null,
 *     work_description?: string|null,
 *     work_description_hi?: string|null,
 *     cost?: number|null,
 *     completion_date?: string|null,
 *     completion_year?: number|null,
 *     mp_name?: string|null,
 *     mp_name_hi?: string|null,
 *     constituency?: string|null,
 *     constituency_hi?: string|null,
 *     state?: string|null,
 *     state_hi?: string|null,
 *     house?: string|null,
 *     category?: string|null,
 *     category_hi?: string|null,
 *     district?: string|null,
 *     district_hi?: string|null,
 *     location?: string|null,
 *     location_hi?: string|null,
 *     beneficiaries?: number|null,
 *     implementing_agency?: string|null,
 *     implementing_agency_hi?: string|null,
 *     quality_rating?: number|null,
 *     latitude?: number|null,
 *     longitude?: number|null,
 *     photos_metadata?: Record<string, any>|null,
 *     impact_metrics?: Record<string, any>|null,
 *     source: string,
 *     created_at: string,
 *     last_updated: string
 *   }>,
 *   total: number,
 *   page: number,
 *   limit: number,
 *   total_pages: number
 * }>}
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

  const response = await api.get('/works', { params: cleanParams });
  return response.data;
}

/**
 * Alias for getWorks()
 */
export const fetchWorks = getWorks;

/**
 * 4. Single Work Item Detail (GET /api/works/{work_id})
 * Retrieves details for a single work item by its work_id, source_id, or database ID.
 *
 * @param {string|number} workId - Unique identifier of the work item
 * @returns {Promise<{
 *   id: number,
 *   work_id?: number|null,
 *   source_id?: string|null,
 *   work_description?: string|null,
 *   work_description_hi?: string|null,
 *   cost?: number|null,
 *   completion_date?: string|null,
 *   completion_year?: number|null,
 *   mp_name?: string|null,
 *   mp_name_hi?: string|null,
 *   constituency?: string|null,
 *   constituency_hi?: string|null,
 *   state?: string|null,
 *   state_hi?: string|null,
 *   house?: string|null,
 *   category?: string|null,
 *   category_hi?: string|null,
 *   district?: string|null,
 *   district_hi?: string|null,
 *   location?: string|null,
 *   location_hi?: string|null,
 *   beneficiaries?: number|null,
 *   implementing_agency?: string|null,
 *   implementing_agency_hi?: string|null,
 *   quality_rating?: number|null,
 *   latitude?: number|null,
 *   longitude?: number|null,
 *   photos_metadata?: Record<string, any>|null,
 *   impact_metrics?: Record<string, any>|null,
 *   source: string,
 *   created_at: string,
 *   last_updated: string
 * }>}
 */
export async function getWorkById(workId) {
  if (workId === undefined || workId === null || workId === '') {
    throw new ApiError('workId is required to fetch work details', 400);
  }
  const response = await api.get(`/works/${encodeURIComponent(String(workId).trim())}`);
  return response.data;
}

/**
 * Alias for getWorkById()
 */
export const fetchWorkById = getWorkById;
export const getWork = getWorkById;

/**
 * 5. Paginated MP Financial Summaries (GET /api/mps)
 * Retrieves paginated MP financial and execution summary records.
 *
 * @param {Object} [params={}]
 * @param {number} [params.page=1] - Page number (1-indexed)
 * @param {number} [params.limit=20] - Items per page (1-100)
 * @param {string} [params.constituency] - Filter by constituency name
 * @param {string} [params.state] - Filter by state name
 * @param {string} [params.house] - Filter by house (Lok Sabha / Rajya Sabha)
 * @returns {Promise<{
 *   items: Array<{
 *     id: number,
 *     source_id?: string|null,
 *     mp_name?: string|null,
 *     house?: string|null,
 *     state?: string|null,
 *     constituency?: string|null,
 *     allocated_amount?: number|null,
 *     total_expenditure?: number|null,
 *     total_recommended_amount?: number|null,
 *     utilization_percentage?: number|null,
 *     recommendation_utilization_percentage?: number|null,
 *     expenditure_percentage?: number|null,
 *     utilization_definition?: string|null,
 *     completed_works_count?: number|null,
 *     recommended_works_count?: number|null,
 *     completion_rate?: number|null,
 *     pending_works?: number|null,
 *     unspent_amount?: number|null,
 *     unpaid_balance?: number|null,
 *     completed_works_value?: number|null,
 *     total_completed_amount?: number|null,
 *     in_progress_payments?: number|null,
 *     payment_gap_percentage?: number|null,
 *     source: string,
 *     created_at: string,
 *     last_updated: string
 *   }>,
 *   total: number,
 *   page: number,
 *   limit: number,
 *   total_pages: number
 * }>}
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

  const response = await api.get('/mps', { params: cleanParams });
  return response.data;
}

/**
 * Alias for getMPs()
 */
export const fetchMPs = getMPs;

/**
 * 6. Single MP Financial Summary (GET /api/mps/{mp_id})
 * Retrieves financial metrics for a single MP by database ID or source_id.
 *
 * @param {string|number} mpId - MP database ID or source_id
 * @returns {Promise<{
 *   id: number,
 *   source_id?: string|null,
 *   mp_name?: string|null,
 *   house?: string|null,
 *   state?: string|null,
 *   constituency?: string|null,
 *   allocated_amount?: number|null,
 *   total_expenditure?: number|null,
 *   total_recommended_amount?: number|null,
 *   utilization_percentage?: number|null,
 *   recommendation_utilization_percentage?: number|null,
 *   expenditure_percentage?: number|null,
 *   utilization_definition?: string|null,
 *   completed_works_count?: number|null,
 *   recommended_works_count?: number|null,
 *   completion_rate?: number|null,
 *   pending_works?: number|null,
 *   unspent_amount?: number|null,
 *   unpaid_balance?: number|null,
 *   completed_works_value?: number|null,
 *   total_completed_amount?: number|null,
 *   in_progress_payments?: number|null,
 *   payment_gap_percentage?: number|null,
 *   source: string,
 *   created_at: string,
 *   last_updated: string
 * }>}
 */
export async function getMPById(mpId) {
  if (mpId === undefined || mpId === null || mpId === '') {
    throw new ApiError('mpId is required to fetch MP details', 400);
  }
  const response = await api.get(`/mps/${encodeURIComponent(String(mpId).trim())}`);
  return response.data;
}

/**
 * Alias for getMPById()
 */
export const fetchMPById = getMPById;
export const getMP = getMPById;

/* ==========================================================================
   State Helpers & Utilities (Loading / Fallback / Execution)
   ========================================================================== */

/**
 * Creates a standard initial resource state object.
 * @template T
 * @param {T} [defaultData=null]
 * @returns {{ data: T, loading: boolean, error: string|null }}
 */
export function createInitialState(defaultData = null) {
  return {
    data: defaultData,
    loading: true,
    error: null,
  };
}

/**
 * Safely executes an async API call, returning [data, error].
 * Useful for component lifecycles without try/catch boilerplate.
 *
 * @template T
 * @param {() => Promise<T>} apiCall
 * @returns {Promise<[T|null, ApiError|null]>}
 */
export async function handleApiCall(apiCall) {
  try {
    const data = await apiCall();
    return [data, null];
  } catch (error) {
    return [null, error instanceof ApiError ? error : new ApiError(error.message)];
  }
}

export default api;
