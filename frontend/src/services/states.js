/**
 * JanDrishti - State Intelligence API Client
 * Interacts with /api/states endpoints for State & Union Territory analytics
 */

import { api } from './api';

/**
 * Fetch list of all States and Union Territories with aggregations & national summary
 */
export async function fetchStates({
  search = '',
  region = '',
  status = '',
  sort_by = 'utilization',
  order = 'desc',
} = {}) {
  const params = {};
  if (search && search.trim()) params.search = search.trim();
  if (region && region !== 'All States & UTs' && region !== 'all') params.region = region;
  if (status && status !== 'All' && status !== 'all') params.status = status;
  if (sort_by) params.sort_by = sort_by;
  if (order) params.order = order;

  const response = await api.get('/states', { params });
  return response.data;
}

/**
 * Fetch high-level national state summary
 */
export async function fetchNationalSummary() {
  const response = await api.get('/states/national-summary');
  return response.data;
}

/**
 * Fetch full 360° State Intelligence Profile by slug or name
 */
export async function fetchStateById(stateId) {
  const response = await api.get(`/states/${encodeURIComponent(stateId)}`);
  return response.data;
}

/**
 * Fetch analytical signals for a specific state
 */
export async function fetchStateSignals(stateId) {
  const response = await api.get(`/states/${encodeURIComponent(stateId)}/signals`);
  return response.data;
}

/**
 * Fetch exportable state snapshot summary
 */
export async function fetchStateExport(stateId) {
  const response = await api.get(`/states/${encodeURIComponent(stateId)}/export`);
  return response.data;
}
