import api from './api';

/**
 * Triggers data synchronization across external MPLADS sources
 * @param {{
 *   constituency?: string,
 *   state?: string,
 *   max_pages?: number
 * }} options
 */
export async function triggerSync(options = {}) {
  const params = {};
  if (options.constituency) params.constituency = options.constituency;
  if (options.state) params.state = options.state;
  if (options.max_pages) params.max_pages = options.max_pages;

  const response = await api.post('/sync', null, { params });
  return response.data;
}
