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

  // Load paginated MPs based on current query and filters
  const loadMPs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
        house: house && house !== 'All' ? house : undefined,
        state: state || undefined,
        constituency: constituency || undefined,
        search: searchQuery.trim() || undefined,
      };
      const data = await getMPs(params);
      setMpsData(data || { items: [], total: 0, total_pages: 0 });
    } catch (err) {
      console.error('Error fetching MPs registry:', err);
      setError('Unable to fetch parliamentarian records from the JanDrishti backend.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, house, state, constituency, searchQuery]);

  useEffect(() => {
    loadMPs();
  }, [loadMPs]);

  const handleRowClick = async (mp) => {
    setSelectedMP(mp);
    if (!mp.id) return;

    setLoadingDetail(true);
    try {
      const fullDetail = await getMPById(mp.id);
      if (fullDetail) {
        setSelectedMP((prev) => ({ ...prev, ...fullDetail }));
      }
    } catch (e) {
      console.warn('Could not fetch additional MP detail:', e);
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

  // The displayed items match backend returned paginated dataset
  const displayedMPs = mpsData.items || [];

  // Color helper for utilization percentage in brown palette
  const getUtilizationColor = (util) => {
    const val = Number(util || 0);
    if (val >= 80) return { text: 'text-[#44312A]', bar: 'bg-[#44312A]' };
    if (val >= 50) return { text: 'text-[#6B5145]', bar: 'bg-[#6B5145]' };
    return { text: 'text-[#8C7769]', bar: 'bg-[#8C7769]' };
  };

  // Case-insensitive match helper for selected constituency in dropdown
  const currentConstituencyValue = useMemo(() => {
    if (!constituency) return '';
    const match = availableConstituencies.find(
      (c) => c.toLowerCase() === constituency.toLowerCase()
    );
    return match || constituency;
  }, [constituency, availableConstituencies]);

  // Case-insensitive match helper for selected state in dropdown
  const currentStateValue = useMemo(() => {
    if (!state) return '';
    const match = availableStates.find(
      (s) => s.toLowerCase() === state.toLowerCase()
    );
    return match || state;
  }, [state, availableStates]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#44312A] tracking-tight font-display">
              Parliamentarian Financial Ledgers
            </h1>
            <Badge variant="primary" size="sm">
              MP LEDGERS
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Verified financial allocations, completed expenditures, and utilization indices across Lok Sabha & Rajya Sabha MPs.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[#504F47]">
          <span>Parliamentarians Tracked:</span>
          <strong className="text-[#44312A] font-bold font-mono">
            {formatIndianNumber(mpsData.total)}
          </strong>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <form onSubmit={handleApplyFilters} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Quick Search */}
            <div>
              <label className="block text-[11px] font-bold text-[#504F47] mb-1">
                Search MP Name
              </label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7769]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g. Narendra Modi or Ravi Kishan"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
                />
              </div>
            </div>

            {/* House Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[#504F47] mb-1">
                Parliamentary House
              </label>
              <select
                value={house}
                onChange={(e) => {
                  setHouse(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] focus:outline-none focus:border-[#44312A]"
              >
                <option value="">All Houses</option>
                <option value="Lok Sabha">Lok Sabha</option>
                <option value="Rajya Sabha">Rajya Sabha</option>
              </select>
            </div>

            {/* State Filter Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-[#504F47] mb-1">
                State
              </label>
              <select
                value={currentStateValue}
                onChange={(e) => {
                  setState(e.target.value);
                  setConstituency('');
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] focus:outline-none focus:border-[#44312A]"
              >
                <option value="">All States ({availableStates.length})</option>
                {availableStates.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Constituency Filter Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-[#504F47] mb-1">
                Constituency
              </label>
              <select
                value={currentConstituencyValue}
                onChange={(e) => {
                  setConstituency(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] focus:outline-none focus:border-[#44312A]"
              >
                <option value="">
                  {state
                    ? `All in ${state} (${availableConstituencies.length})`
                    : `All Constituencies (${availableConstituencies.length})`}
                </option>
                {availableConstituencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 px-3 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#44312A]/20"
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
        <TableSkeleton rows={8} cols={7} />
      ) : displayedMPs.length === 0 ? (
        <EmptyState
          title="No parliamentarians match criteria"
          description="Adjust your House, State, or Constituency filters to load additional MP performance summaries."
          action={
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 rounded-xl bg-[#44312A] text-[#E7DDCA] font-bold text-xs"
            >
              Reset Filters
            </button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#D8CBB6] text-[#504F47] uppercase font-mono text-[10px] tracking-wider sticky top-0 z-10 font-bold">
                  <th className="py-3.5 px-4">Member of Parliament</th>
                  <th className="py-3.5 px-4">House</th>
                  <th className="py-3.5 px-4">Constituency / State</th>
                  <th className="py-3.5 px-4 text-right">Allocated</th>
                  <th className="py-3.5 px-4 text-right">Expenditure</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Utilization %</th>
                  <th className="py-3.5 px-4 text-center">Works (Comp / Rec)</th>
                  <th className="py-3.5 px-4 text-right">Unspent Balance</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CBB6]">
                {displayedMPs.map((mp) => {
                  const util = mp.utilization_percentage !== null && mp.utilization_percentage !== undefined
                    ? Number(mp.utilization_percentage)
                    : null;
                  const utilColor = getUtilizationColor(util || 0);
                  const allocated = formatCroresLakhs(mp.allocated_amount);
                  const expenditure = formatCroresLakhs(mp.total_expenditure);
                  const unspent = formatCroresLakhs(mp.unspent_amount);

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

                      {/* Utilization with Progress Bar */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[11px] font-mono font-bold">
                            <span className={util !== null ? utilColor.text : 'text-[#8C7769]'}>
                              {util !== null ? `${util.toFixed(1)}%` : 'N/A'}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#E7DDCA] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${utilColor.bar}`}
                              style={{ width: `${Math.min(100, Math.max(0, util || 0))}%` }}
                            />
                          </div>
                        </div>
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
                          title="Open Slide-Over Panel"
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

      {/* Slide-Over MP Detail Panel (Drawer) in Brown & Cream */}
      {selectedMP && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-white border-l border-[#D8CBB6] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
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
                  <span className="text-[#504F47]">Expenditure Utilization:</span>
                  <strong className="text-[#44312A] font-mono font-bold">
                    {selectedMP.utilization_percentage !== null && selectedMP.utilization_percentage !== undefined
                      ? `${Number(selectedMP.utilization_percentage).toFixed(1)}%`
                      : 'N/A'}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                  <span className="text-[#504F47]">Unspent Parliamentary Balance:</span>
                  <span className="text-[#504F47] font-mono font-bold">
                    {formatCroresLakhs(selectedMP.unspent_amount).compact}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#504F47]">Payment Gap / In-Progress:</span>
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
                  <span>View Constituency Works ({selectedMP.constituency})</span>
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
