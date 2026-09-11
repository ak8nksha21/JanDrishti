import api, { getHealth, checkHealth, getBaseURL, getRootURL } from './api';

export { getHealth, checkHealth, getBaseURL, getRootURL };

/**
 * Telemetry from dataset management endpoint
 */
export async function fetchDatasetStats() {
  try {
    const response = await api.get('/dataset/stats');
    return response.data;
  } catch (e) {
    return null;
  }
}

export default {
  getHealth,
  checkHealth,
  fetchDatasetStats,
};
