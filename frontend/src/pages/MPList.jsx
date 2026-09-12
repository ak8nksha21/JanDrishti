import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  X,
  ExternalLink,
  Briefcase,
  IndianRupee,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { getMPs, getMPById } from '../services/api';
import {
  formatCroresLakhs,
  formatIndianNumber,
} from '../utils/formatting';
import { calculateMPRisk, getMPRiskBadgeConfig, MP_RISK_DISCLAIMER } from '../utils/mpRisk';
import { useRouter, useSearchParams, Link } from '../router/Router';

export default function MPList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { navigate } = useRouter();

  const initialPage = Number(searchParams.get('page')) || 1;
  const initialLimit = Number(searchParams.get('limit')) || 20;
  const initialHouse = searchParams.get('house') || '';
  const initialState = searchParams.get('state') || '';
  const initialConstituency = searchParams.get('constituency') || '';
  const initialSearch = searchParams.get('search') || searchParams.get('q') || '';

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [house, setHouse] = useState(initialHouse);
  const [state, setState] = useState(initialState);
  const [constituency, setConstituency] = useState(initialConstituency);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const [mpsData, setMpsData] = useState({ items: [], total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Complete registry list for dynamic filter options (all 774 MPs)
  const [allMPsRegistry, setAllMPsRegistry] = useState([]);

  // Selected MP for slide-over detail panel
  const [selectedMP, setSelectedMP] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load all MP records once to dynamically populate complete State & Constituency options
  useEffect(() => {
    let isMounted = true;
    async function fetchAllOptions() {
      try {
        const fullRegistry = await getMPs({ limit: 1000 });
        if (isMounted && fullRegistry && Array.isArray(fullRegistry.items)) {
          setAllMPsRegistry(fullRegistry.items);
        }
      } catch (e) {
        console.warn('Could not load full MP registry for filter dropdowns:', e);
      }
    }
    fetchAllOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute distinct states from all MP records
  const availableStates = useMemo(() => {
    let items = allMPsRegistry;
    if (house && house !== 'All') {
      items = items.filter((m) => m.house && m.house.toLowerCase() === house.toLowerCase());
    }
    const statesSet = new Set();
    items.forEach((m) => {
      if (m.state && m.state.trim()) {
        statesSet.add(m.state.trim());
      }
    });
    return Array.from(statesSet).sort((a, b) => a.localeCompare(b));
  }, [allMPsRegistry, house]);

  // Compute distinct constituencies from all MP records, filtered by state and house if selected
  const availableConstituencies = useMemo(() => {
    let items = allMPsRegistry;
    if (house && house !== 'All') {
      items = items.filter((m) => m.house && m.house.toLowerCase() === house.toLowerCase());
    }
    if (state && state.trim()) {
      items = items.filter((m) => m.state && m.state.toLowerCase() === state.toLowerCase().trim());
    }
    const constSet = new Set();
    items.forEach((m) => {
      if (m.constituency && m.constituency.trim()) {
        constSet.add(m.constituency.trim());
      }
    });
    return Array.from(constSet).sort((a, b) => a.localeCompare(b));
  }, [allMPsRegistry, house, state]);

  // Sync state with URL params
  useEffect(() => {
    const urlHouse = searchParams.get('house') || '';
    const urlState = searchParams.get('state') || '';
    const urlConstituency = searchParams.get('constituency') || '';
    const urlSearch = searchParams.get('search') || searchParams.get('q') || '';
    const urlPage = Number(searchParams.get('page')) || 1;
    const urlLimit = Number(searchParams.get('limit')) || 20;

    setHouse(urlHouse);
    setState(urlState);
    setConstituency(urlConstituency);
    setPage(urlPage);
    setLimit(urlLimit);
    if (urlSearch) setSearchQuery(urlSearch);
  }, [searchParams]);

  const loadMPs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
        house: house || undefined,
        state: state || undefined,
        constituency: constituency || undefined,
        search: searchQuery.trim() || undefined,
      };
      const data = await getMPs(params);
      setMpsData(data || { items: [], total: 0, total_pages: 0 });
    } catch (err) {
      console.error('Error fetching MP records:', err);
      setError('Unable to fetch parliamentarian financial records from the JanDrishti backend.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, house, state, constituency, searchQuery]);

  useEffect(() => {
    loadMPs();
  }, [loadMPs]);

  const handleRowClick = async (mp) => {
    setSelectedMP(mp);
    if (!mp?.id) return;

    setLoadingDetail(true);
    try {
      const fullDetail = await getMPById(mp.id);
      if (fullDetail) {
        setSelectedMP((prev) => ({ ...prev, ...fullDetail }));
      }
    } catch (e) {
      console.warn('Could not fetch full details for MP:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApplyFilters = (e) => {
    e?.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (house && house !== 'All') params.set('house', house);
    if (state) params.set('state', state);
    if (constituency) params.set('constituency', constituency);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (limit !== 20) params.set('limit', String(limit));
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleResetFilters = () => {
    setHouse('');
    setState('');
    setConstituency('');
    setSearchQuery('');
    setPage(1);
    setSearchParams({});
  };

  const displayedMPs = mpsData.items || [];

  const getUtilizationColor = (util) => {
    if (util >= 75) return { text: 'text-[#44312A]', bar: 'bg-[#44312A]' };
    if (util >= 40) return { text: 'text-[#6B5145]', bar: 'bg-[#6B5145]' };
    return { text: 'text-[#8C7769]', bar: 'bg-[#8C7769]' };
  };

  const selectedMPRisk = selectedMP ? calculateMPRisk(selectedMP) : null;
  const selectedMPRiskBadge = selectedMPRisk ? getMPRiskBadgeConfig(selectedMPRisk.level) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#44312A] tracking-tight font-display">
              Parliamentarian Financial Intelligence
            </h1>
            <Badge variant="primary" size="sm">
              774 MPS
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Parliamentary financial ledgers, expenditure utilization metrics, and multi-factor portfolio risk indicators across all monitored MPs.
          </p>
        </div>
      </div>

      {/* Filter Card */}
      <Card className="p-4 bg-white">
        <form onSubmit={handleApplyFilters} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8C7769]" />
              <input
                type="text"
                placeholder="Search MP, constituency, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
              />
            </div>

            {/* House Filter */}
            <div>
              <select
                value={house}
                onChange={(e) => setHouse(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A] focus:outline-none focus:border-[#44312A]"
              >
                <option value="">All Houses</option>
                <option value="Lok Sabha">Lok Sabha</option>
                <option value="Rajya Sabha">Rajya Sabha</option>
              </select>
            </div>

            {/* State Filter */}
            <div className="relative">
              <input
                type="text"
                list="state-filter-options"
                placeholder="Filter by state..."
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
              />
              <datalist id="state-filter-options">
                {availableStates.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Constituency Filter */}
            <div className="relative">
              <input
                type="text"
                list="constituency-filter-options"
                placeholder="Filter by constituency..."
                value={constituency}
                onChange={(e) => setConstituency(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
              />
              <datalist id="constituency-filter-options">
                {availableConstituencies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 px-3 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Filter className="h-3 w-3 text-[#E7DDCA]" />
                <span>Filter</span>
              </button>
              {(house || state || constituency || searchQuery) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="p-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] transition cursor-pointer border border-[#D8CBB6]"
                  title="Clear filters"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </form>
      </Card>

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={loadMPs} />}

      {/* MP Table */}
      {loading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : displayedMPs.length === 0 ? (
        <EmptyState
          title="No parliamentarians match criteria"
          description="Adjust your House, State, or Constituency filters to load additional MP performance summaries."
          onAction={handleResetFilters}
          actionLabel="Reset Filters"
        />
      ) : (
        <Card className="overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#D8CBB6] text-[#504F47] uppercase font-mono text-[10px] tracking-wider sticky top-0 z-10 font-bold">
                  <th className="py-3.5 px-4">Member of Parliament</th>
                  <th className="py-3.5 px-4">House</th>
                  <th className="py-3.5 px-4">Constituency / State</th>
                  <th className="py-3.5 px-4 text-right">Allocated</th>
                  <th className="py-3.5 px-4 text-right">Expenditure</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Expenditure Util %</th>
                  <th className="py-3.5 px-4 text-center">Portfolio Risk</th>
                  <th className="py-3.5 px-4 text-center">Works (Comp / Rec)</th>
                  <th className="py-3.5 px-4 text-right">Unspent Balance</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CBB6]">
                {displayedMPs.map((mp) => {
                  const expUtil = mp.expenditure_percentage !== null && mp.expenditure_percentage !== undefined
                    ? Number(mp.expenditure_percentage)
                    : mp.allocated_amount
                    ? (Number(mp.total_expenditure) / Number(mp.allocated_amount)) * 100
                    : null;
                  const recUtil = mp.recommendation_utilization_percentage !== null && mp.recommendation_utilization_percentage !== undefined
                    ? Number(mp.recommendation_utilization_percentage)
                    : mp.utilization_percentage !== null && mp.utilization_percentage !== undefined
                    ? Number(mp.utilization_percentage)
                    : null;
                  const utilColor = getUtilizationColor(expUtil || 0);
                  const allocated = formatCroresLakhs(mp.allocated_amount);
                  const expenditure = formatCroresLakhs(mp.total_expenditure);
                  const unspent = formatCroresLakhs(mp.unspent_amount);

                  // Compute Indicative MP Risk
                  const rowRisk = calculateMPRisk(mp);
                  const rowRiskBadge = getMPRiskBadgeConfig(rowRisk.level);

                  return (
                    <tr
                      key={mp.id}
                      onClick={() => handleRowClick(mp)}
                      className="hover:bg-[#FAF7F2] cursor-pointer transition-colors group"
                    >
                      {/* MP Name */}
                      <td className="py-3.5 px-4">
                        <div className="text-[#44312A] font-bold group-hover:text-[#6B5145] transition-colors">
                          {mp.mp_name || 'N/A'}
                        </div>
                      </td>

                      {/* House */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={mp.house === 'Rajya Sabha' ? 'outline' : 'default'}
                          size="sm"
                        >
                          {mp.house || 'Lok Sabha'}
                        </Badge>
                      </td>

                      {/* Constituency / State */}
                      <td className="py-3.5 px-4">
                        <div className="text-[#44312A] font-medium">{mp.constituency || 'Nominated / N/A'}</div>
                        <div className="text-[10px] text-[#504F47]">{mp.state || 'N/A'}</div>
                      </td>

                      {/* Allocated */}
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-[#504F47]">
                        {allocated.compact}
                      </td>

                      {/* Expenditure */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#44312A]">
                        {expenditure.compact}
                      </td>

                      {/* Expenditure Utilization with Progress Bar & Recommendation Rate */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[11px] font-mono font-bold">
                            <span className={expUtil !== null ? utilColor.text : 'text-[#8C7769]'}>
                              {expUtil !== null ? `${expUtil.toFixed(1)}%` : 'N/A'}
                            </span>
                            {recUtil !== null && (
                              <span className="text-[9.5px] text-[#8C7769] font-normal" title="Recommendation Utilization">
                                Rec: {recUtil.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#E7DDCA] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${utilColor.bar}`}
                              style={{ width: `${Math.min(100, Math.max(0, expUtil || 0))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Indicative Portfolio Risk */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10.5px] font-mono font-bold border ${rowRiskBadge.bgClass}`}
                          title={`Indicative MP Portfolio Risk Score: ${rowRisk.score !== null ? rowRisk.score : 'N/A'}/100`}
                        >
                          {rowRisk.score !== null ? `${rowRisk.score}` : 'N/A'} • {rowRisk.level}
                        </span>
                      </td>

                      {/* Works Count (Completed / Recommended) */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span className="text-[#44312A] font-bold">
                          {formatIndianNumber(mp.completed_works_count)}
                        </span>
                        <span className="text-[#8C7769] mx-1">/</span>
                        <span className="text-[#504F47]">
                          {formatIndianNumber(mp.recommended_works_count)}
                        </span>
                      </td>

                      {/* Unspent */}
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-[#504F47]">
                        {unspent.compact}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(mp);
                          }}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-[#FAF7F2] text-[#504F47] group-hover:text-[#44312A] group-hover:bg-[#E7DDCA] border border-[#D8CBB6] transition cursor-pointer"
                          title="Open Slide-Over Audit Panel"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-[#D8CBB6] bg-[#FAF7F2] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#504F47]">
            <div>
              Showing page <strong className="text-[#44312A]">{mpsData.page || 1}</strong> of{' '}
              <strong className="text-[#44312A]">{mpsData.total_pages || 1}</strong> ({formatIndianNumber(mpsData.total)} parliamentarians)
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#D8CBB6] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed text-[#44312A] font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <span className="font-mono text-[#44312A] px-2 font-semibold">
                {page} / {mpsData.total_pages || 1}
              </span>
              <button
                disabled={page >= mpsData.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#D8CBB6] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed text-[#44312A] font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Slide-Over MP Detail Drawer */}
      {selectedMP && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white border-l border-[#D8CBB6] shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="p-4 border-b border-[#D8CBB6] bg-[#FAF7F2] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-sm font-bold text-[#44312A] font-mono">
                {selectedMP.mp_name ? selectedMP.mp_name.substring(0, 2).toUpperCase() : 'MP'}
              </div>
              <div>
                <span className="text-xs font-mono text-[#8C7769]">MP ID #{selectedMP.id}</span>
                <h3 className="text-sm font-bold text-[#44312A] leading-tight">
                  {selectedMP.mp_name}
                </h3>
              </div>
            </div>
            <button
              onClick={() => setSelectedMP(null)}
              className="p-1.5 rounded-xl bg-white border border-[#D8CBB6] text-[#504F47] hover:text-[#44312A] transition cursor-pointer shadow-xs"
              title="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs text-[#504F47]">
            {/* Constituency & House Details */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
              <div>
                <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">
                  Constituency & State
                </span>
                <span className="text-sm font-bold text-[#44312A]">
                  {selectedMP.constituency || 'Nominated / N/A'}
                </span>
                <div className="text-[11px] text-[#504F47]">{selectedMP.state || 'N/A'}</div>
              </div>
              <Badge variant={selectedMP.house === 'Rajya Sabha' ? 'outline' : 'primary'} size="sm">
                {selectedMP.house || 'Lok Sabha'}
              </Badge>
            </div>

            {/* Indicative MP Portfolio Risk Card (5-Factor Engine) */}
            {selectedMPRisk && (
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border-2 border-[#D8CBB6] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-[#44312A]" />
                    <span className="font-bold text-xs text-[#44312A]">Indicative MP Portfolio Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black font-mono text-[#44312A]">
                      {selectedMPRisk.score !== null ? `${selectedMPRisk.score}` : 'N/A'}/100
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${selectedMPRiskBadge.bgClass}`}>
                      {selectedMPRisk.level}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#504F47] leading-relaxed">
                  Composite analytical risk based on 5 equal-weighted financial and execution indicators (20% each).
                </p>

                {/* Mini Factor Breakdown */}
                <div className="space-y-1.5 pt-1 border-t border-[#D8CBB6]">
                  {selectedMPRisk.breakdown.map((b) => (
                    <div key={b.key} className="flex justify-between items-center text-[11px]">
                      <span className="text-[#504F47]">{b.title}:</span>
                      <span className="font-mono font-bold text-[#44312A]">
                        {b.score} / 100 ({b.valueDisplay})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Ledger Breakdown */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5 text-[#44312A]" />
                <span>Financial Disbursements</span>
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                  <span className="text-[10px] uppercase font-mono text-[#504F47] block font-bold">
                    Allocated Limit
                  </span>
                  <span className="text-base font-black font-mono text-[#44312A]">
                    {formatCroresLakhs(selectedMP.allocated_amount).compact}
                  </span>
                  <span className="text-[10px] text-[#8C7769] font-mono block mt-0.5">
                    {formatCroresLakhs(selectedMP.allocated_amount).exact}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                  <span className="text-[10px] uppercase font-mono text-[#504F47] block font-bold">
                    Total Expenditure
                  </span>
                  <span className="text-base font-black font-mono text-[#44312A]">
                    {formatCroresLakhs(selectedMP.total_expenditure).compact}
                  </span>
                  <span className="text-[10px] text-[#8C7769] font-mono block mt-0.5">
                    {formatCroresLakhs(selectedMP.total_expenditure).exact}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-2">
                <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                  <span className="text-[#44312A] font-bold">Expenditure Utilization:</span>
                  <strong className="text-[#44312A] font-mono font-bold">
                    {selectedMP.expenditure_percentage !== null && selectedMP.expenditure_percentage !== undefined
                      ? `${Number(selectedMP.expenditure_percentage).toFixed(1)}%`
                      : selectedMP.allocated_amount
                      ? `${((Number(selectedMP.total_expenditure) / Number(selectedMP.allocated_amount)) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                  <div>
                    <span className="text-[#504F47] font-semibold block">Recommendation Utilization:</span>
                    <span className="text-[10px] text-[#8C7769]">Recommended works / Allocation</span>
                  </div>
                  <span className="text-[#504F47] font-mono font-bold">
                    {selectedMP.recommendation_utilization_percentage !== null && selectedMP.recommendation_utilization_percentage !== undefined
                      ? `${Number(selectedMP.recommendation_utilization_percentage).toFixed(1)}%`
                      : selectedMP.utilization_percentage !== null && selectedMP.utilization_percentage !== undefined
                      ? `${Number(selectedMP.utilization_percentage).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                  <span className="text-[#504F47]">Unspent Parliamentary Balance:</span>
                  <span className="text-[#504F47] font-mono font-bold">
                    {formatCroresLakhs(selectedMP.unspent_amount).compact}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <div>
                    <span className="text-[#504F47] block">In-Progress Outlays Ratio:</span>
                    <span className="text-[10px] text-[#8C7769]">Disbursements tied to active works</span>
                  </div>
                  <span className="text-[#44312A] font-mono font-medium">
                    {selectedMP.payment_gap_percentage !== null && selectedMP.payment_gap_percentage !== undefined
                      ? `${Number(selectedMP.payment_gap_percentage).toFixed(1)}%`
                      : 'Standard'}
                  </span>
                </div>
              </div>
            </div>

            {/* Works Execution Statistics */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-[#44312A]" />
                <span>Sanction & Completion Statistics</span>
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                  <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">Recommended</span>
                  <span className="text-base font-black font-mono text-[#44312A] mt-0.5 block">
                    {formatIndianNumber(selectedMP.recommended_works_count)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                  <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">Completed</span>
                  <span className="text-base font-black font-mono text-[#44312A] mt-0.5 block">
                    {formatIndianNumber(selectedMP.completed_works_count)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                  <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">Pending</span>
                  <span className="text-base font-black font-mono text-[#6B5145] mt-0.5 block">
                    {formatIndianNumber(selectedMP.pending_works || Math.max(0, (selectedMP.recommended_works_count || 0) - (selectedMP.completed_works_count || 0)))}
                  </span>
                </div>
              </div>
            </div>

            {/* PII Sanitization Assurance */}
            <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] text-[11px] text-[#504F47] flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#44312A] shrink-0" />
              <span>Personal contact and private PII data sanitized per privacy standards.</span>
            </div>

            {/* Direct Navigation Links */}
            <div className="pt-2 space-y-2">
              {selectedMP.constituency && (
                <Link
                  to={`/works?constituency=${encodeURIComponent(selectedMP.constituency)}`}
                  className="w-full py-2 px-3 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer border border-[#D8CBB6]"
                >
                  <Briefcase className="h-3.5 w-3.5 text-[#44312A]" />
                  <span>Itemized works for {selectedMP.constituency}</span>
                </Link>
              )}
              <Link
                to={`/mps/${selectedMP.id}`}
                className="w-full py-2.5 px-4 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#44312A]/20"
              >
                <span>Open Full MP Performance Dossier</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#E7DDCA]" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
