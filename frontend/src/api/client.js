import api, {
  getBaseURL,
  getRootURL,
  getHealth,
  checkHealth,
  getDashboard,
  fetchDashboard,
  fetchDashboardSummary,
  getWorks,
  fetchWorks,
  getWorkById,
  fetchWorkById,
  getWork,
  getMPs,
  fetchMPs,
  getMPById,
  fetchMPById,
  getMP,
  runAIInvestigation,
  fetchInvestigationTools,
  fetchRiskSummary,
  fetchWorkDetail,
  fetchAgencyBenchmarks,
  fetchAlerts,
  updateAlertStatus,
  fetchAuditLogs,
  fetchDatasetStats,
  triggerSync,
} from '../services/api';

export {
  getBaseURL,
  getRootURL,
  getHealth,
  checkHealth,
  getDashboard,
  fetchDashboard,
  fetchDashboardSummary,
  getWorks,
  fetchWorks,
  getWorkById,
  fetchWorkById,
  getWork,
  getMPs,
  fetchMPs,
  getMPById,
  fetchMPById,
  getMP,
  runAIInvestigation,
  fetchInvestigationTools,
  fetchRiskSummary,
  fetchWorkDetail,
  fetchAgencyBenchmarks,
  fetchAlerts,
  updateAlertStatus,
  fetchAuditLogs,
  fetchDatasetStats,
  triggerSync,
};

// Aliases for legacy compatibility
export const fetchRiskWorks = getWorks;

export const triggerLiveSync = async (constituency = 'SHAHJAHANPUR', limit = 100) => {
  return triggerSync({ constituency, max_pages: 5 });
};

export const triggerCsvLoad = async (maxRecords = 200, constituency = null) => {
  const params = { max_records: maxRecords };
  if (constituency) params.constituency = constituency;
  const res = await api.post('/dataset/load-csv', null, { params });
  return res.data;
};

export default api;
