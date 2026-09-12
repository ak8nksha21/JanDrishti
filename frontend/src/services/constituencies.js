import { api } from './api';

/**
 * Fetch paginated and filtered list of constituencies for the Explorer.
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=24]
 * @param {string} [params.search]
 * @param {string} [params.state]
 * @param {string} [params.house]
 * @param {string} [params.status]
 * @param {string} [params.sort_by]
 */
export async function fetchConstituencies(params = {}) {
  const { data } = await api.get('/constituencies', { params });
  return data;
}

/**
 * Fetch complete 360° Digital Twin profile for a specific constituency.
 * @param {string} constituencyId (Slug or raw name)
 */
export async function fetchConstituencyById(constituencyId) {
  const { data } = await api.get(`/constituencies/${encodeURIComponent(constituencyId)}`);
  return data;
}

/**
 * Fetch paginated itemized works belonging to a specific constituency.
 * @param {string} constituencyId
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.category]
 * @param {string} [params.agency]
 * @param {string} [params.search]
 * @param {string} [params.sort_by]
 */
export async function fetchConstituencyWorks(constituencyId, params = {}) {
  const { data } = await api.get(`/constituencies/${encodeURIComponent(constituencyId)}/works`, { params });
  return data;
}

/**
 * Fetch analytical review signals with 'Why' explanation metadata.
 * @param {string} constituencyId
 */
export async function fetchConstituencySignals(constituencyId) {
  const { data } = await api.get(`/constituencies/${encodeURIComponent(constituencyId)}/signals`);
  return data;
}

/**
 * Export constituency snapshot payload.
 * @param {string} constituencyId
 */
export async function fetchConstituencySnapshot(constituencyId) {
  const { data } = await api.get(`/constituencies/${encodeURIComponent(constituencyId)}/export`);
  return data;
}
