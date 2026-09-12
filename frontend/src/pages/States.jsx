import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Building2,
  Users,
  Briefcase,
  Layers,
  ChevronRight,
  RefreshCw,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import { useRouter } from '../router/Router';
import { fetchStates } from '../services/states';
import { formatCroresLakhs } from '../utils/formatting';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

/**
 * Status Badge Component for States
 */
function StateStatusBadge({ status }) {
  if (status === 'Strong Utilization') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E2ECE9] text-[#2D5A27] border border-[#2D5A27]/20 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2D5A27]" />
        Strong Utilization
      </span>
    );
  }
  if (status === 'Moderate Utilization') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FAF3E0] text-[#8C6D23] border border-[#8C6D23]/25 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8C6D23]" />
        Moderate Utilization
      </span>
    );
  }
  if (status === 'Requires Attention') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FCE8E6] text-[#A83232] border border-[#A83232]/25 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#A83232]" />
        Requires Attention
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E7DDCA]/60 text-[#504F47] border border-[#D8CBB6]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#8C7769]" />
      Insufficient Data
    </span>
  );
}

export default function States() {
  const { navigate } = useRouter();

  // State Management
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('All States & UTs');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('highest_utilization');

  // National Comparison Chart Toggle (utilization / expenditure / works)
  const [chartMetric, setChartMetric] = useState('utilization');

  // Load States & UTs
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStates({
        search,
        region: regionFilter,
        status: statusFilter,
        sort_by: sortBy,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load state intelligence data:', err);
      setError('State intelligence data could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 180);
    return () => clearTimeout(timer);
  }, [search, regionFilter, statusFilter, sortBy]);

  // Derived national summary and items
  const items = data?.items || [];
  const national = data?.national_summary || null;

  // States requiring analytical review
  const attentionStates = useMemo(() => {
    if (!items) return [];
    return items.filter((s) => s.requires_attention || s.status === 'Requires Attention').slice(0, 4);
  }, [items]);

  // Chart Data for National Comparison
  const chartData = useMemo(() => {
    if (!items || items.length === 0) return [];
    const copy = [...items];
    if (chartMetric === 'utilization') {
      copy.sort((a, b) => b.utilization_percentage - a.utilization_percentage);
      return copy.slice(0, 15).map((s) => ({
        name: s.state,
        value: s.utilization_percentage,
        formatted: `${s.utilization_percentage.toFixed(1)}%`,
        status: s.status,
      }));
    } else if (chartMetric === 'expenditure') {
      copy.sort((a, b) => b.total_expenditure - a.total_expenditure);
      return copy.slice(0, 15).map((s) => ({
        name: s.state,
        value: Number((s.total_expenditure / 1e7).toFixed(1)),
        formatted: `₹${(s.total_expenditure / 1e7).toFixed(1)} Cr`,
        status: s.status,
      }));
    } else {
      copy.sort((a, b) => b.total_works - a.total_works);
      return copy.slice(0, 15).map((s) => ({
        name: s.state,
        value: s.total_works,
        formatted: `${s.total_works.toLocaleString()} works`,
        status: s.status,
      }));
    }
  }, [items, chartMetric]);

  return (
    <div className="min-h-screen bg-[#E7DDCA] text-[#44312A] pb-24">
      {/* 1. Page Header with National Scope */}
      <div className="border-b border-[#D8CBB6] bg-[#FAF7F2]/80 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7DDCA] text-[#44312A] text-xs font-bold uppercase tracking-wider border border-[#D8CBB6]">
                <Landmark className="h-3.5 w-3.5 text-[#44312A]" />
                <span>36 States & UTs Monitored</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#44312A] font-display">
                State Intelligence
              </h1>
              <p className="text-sm sm:text-base text-[#504F47] max-w-2xl">
                Explore MPLADS funding, utilization, development activity, and implementation patterns across India.
              </p>
            </div>

            {/* Top Summary Metrics */}
            {national && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border border-[#D8CBB6] shadow-sm">
                <div className="px-3 py-1 border-r border-[#E7DDCA]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">States & UTs</div>
                  <div className="text-lg font-black text-[#44312A] font-mono mt-0.5">
                    {national.total_states_monitored}
                  </div>
                </div>

                <div className="px-3 py-1 border-r border-[#E7DDCA]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">National Util.</div>
                  <div className="text-lg font-black text-[#2D5A27] font-mono mt-0.5">
                    {national.national_utilization_percentage.toFixed(1)}%
                  </div>
                </div>

                <div className="px-3 py-1 border-r border-[#E7DDCA]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Allocation</div>
                  <div className="text-lg font-black text-[#44312A] font-mono mt-0.5">
                    {formatCroresLakhs(national.total_national_allocation).compact}
                  </div>
                </div>

                <div className="px-3 py-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Expenditure</div>
                  <div className="text-lg font-black text-[#44312A] font-mono mt-0.5">
                    {formatCroresLakhs(national.total_national_expenditure).compact}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 2. National State Performance Ranked Bar Visualization */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#D8CBB6] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7DDCA] pb-4">
              <div>
                <h2 className="text-base font-bold text-[#44312A] flex items-center gap-2 font-display">
                  <BarChart3 className="h-4 w-4 text-[#44312A]" />
                  <span>National State Performance</span>
                </h2>
                <p className="text-xs text-[#504F47] mt-0.5">
                  Comparative cross-state distribution of MPLADS financial and execution performance.
                </p>
              </div>

              {/* Metric Toggle */}
              <div className="inline-flex p-1 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <button
                  onClick={() => setChartMetric('utilization')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMetric === 'utilization'
                      ? 'bg-[#44312A] text-white shadow-xs'
                      : 'text-[#504F47] hover:text-[#44312A]'
                  }`}
                >
                  Utilization (%)
                </button>
                <button
                  onClick={() => setChartMetric('expenditure')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMetric === 'expenditure'
                      ? 'bg-[#44312A] text-white shadow-xs'
                      : 'text-[#504F47] hover:text-[#44312A]'
                  }`}
                >
                  Expenditure (₹ Cr)
                </button>
                <button
                  onClick={() => setChartMetric('works')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMetric === 'works'
                      ? 'bg-[#44312A] text-white shadow-xs'
                      : 'text-[#504F47] hover:text-[#44312A]'
                  }`}
                >
                  Total Works
                </button>
              </div>
            </div>

            {/* Horizontal Ranked Chart */}
            <div className="h-64 sm:h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#44312A', fontSize: 11, fontWeight: 600 }}
                    width={110}
                  />
                  <Tooltip
                    cursor={{ fill: '#FAF7F2' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-[#44312A] text-white p-2.5 rounded-xl text-xs shadow-xl space-y-1">
                            <div className="font-bold">{d.name}</div>
                            <div className="font-mono text-[#E7DDCA]">
                              {chartMetric === 'utilization' && `Utilization: ${d.formatted}`}
                              {chartMetric === 'expenditure' && `Expenditure: ${d.formatted}`}
                              {chartMetric === 'works' && `Works: ${d.formatted}`}
                            </div>
                            <div className="text-[10px] text-white/70">{d.status}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={12}>
                    {chartData.map((entry, index) => {
                      let color = '#44312A';
                      if (entry.status === 'Strong Utilization') color = '#2D5A27';
                      if (entry.status === 'Requires Attention') color = '#A83232';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 3. States Requiring Attention Banner */}
        {attentionStates.length > 0 && (
          <div className="bg-[#FAF7F2] border border-[#D8CBB6] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#A83232]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#44312A]">
                  States & UTs Requiring Administrative Review
                </h3>
              </div>
              <span className="text-[11px] text-[#504F47]">Identified via analytical thresholds</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {attentionStates.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/states/${s.id}`)}
                  className="bg-white p-3.5 rounded-xl border border-[#D8CBB6] hover:border-[#44312A] transition cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#44312A] group-hover:text-[#44312A] transition">
                      {s.state}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-[#8C7769] group-hover:translate-x-0.5 transition" />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-[#A83232] font-semibold">
                      {s.attention_reason || `Util: ${s.utilization_percentage.toFixed(1)}%`}
                    </span>
                    <span className="font-mono text-[#504F47]">{s.total_works} works</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Search and Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-[#D8CBB6] shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7769]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search states or UTs..."
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-xs text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:ring-1 focus:ring-[#44312A]"
              />
            </div>

            {/* Region / Entity Type Filter */}
            <div>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-xs font-medium text-[#44312A] focus:outline-none focus:ring-1 focus:ring-[#44312A] cursor-pointer"
              >
                <option value="All States & UTs">All States & UTs</option>
                <option value="State">States Only</option>
                <option value="Union Territory">Union Territories Only</option>
              </select>
            </div>

            {/* Performance Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-xs font-medium text-[#44312A] focus:outline-none focus:ring-1 focus:ring-[#44312A] cursor-pointer"
              >
                <option value="All">All Performance Profiles</option>
                <option value="Strong Utilization">Strong Utilization (≥ 45%)</option>
                <option value="Moderate Utilization">Moderate Utilization (25–44%)</option>
                <option value="Requires Attention">Requires Attention (&lt; 25%)</option>
                <option value="Insufficient Data">Insufficient Data</option>
              </select>
            </div>

            {/* Sort Filter */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-xs font-medium text-[#44312A] focus:outline-none focus:ring-1 focus:ring-[#44312A] cursor-pointer"
              >
                <option value="highest_utilization">Sort: Highest Utilization</option>
                <option value="lowest_utilization">Sort: Lowest Utilization</option>
                <option value="highest_expenditure">Sort: Highest Expenditure</option>
                <option value="lowest_expenditure">Sort: Lowest Expenditure</option>
                <option value="most_works">Sort: Most Works</option>
                <option value="most_completed_works">Sort: Most Completed Works</option>
                <option value="state_a_z">Sort: State A–Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* 5. State Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#D8CBB6] p-6 shadow-sm animate-pulse space-y-4">
                <div className="h-5 bg-[#E7DDCA]/60 rounded w-1/2" />
                <div className="h-4 bg-[#E7DDCA]/40 rounded w-1/3" />
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="h-12 bg-[#FAF7F2] rounded-xl" />
                  <div className="h-12 bg-[#FAF7F2] rounded-xl" />
                </div>
                <div className="h-3 bg-[#E7DDCA]/40 rounded w-full" />
                <div className="h-10 bg-[#FAF7F2] rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-[#D8CBB6] p-8 max-w-lg mx-auto space-y-3">
            <AlertTriangle className="h-8 w-8 text-[#A83232] mx-auto" />
            <h3 className="text-base font-bold text-[#44312A]">Unable to Load States</h3>
            <p className="text-xs text-[#504F47]">{error}</p>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-[#44312A] text-white rounded-xl text-xs font-bold hover:bg-[#34241E] transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-[#D8CBB6] p-8 max-w-lg mx-auto space-y-3">
            <Info className="h-8 w-8 text-[#8C7769] mx-auto" />
            <h3 className="text-base font-bold text-[#44312A]">No States or UTs Matched</h3>
            <p className="text-xs text-[#504F47]">
              No State or Union Territory matched your current search filters. Try clearing the filter.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setRegionFilter('All States & UTs');
                setStatusFilter('All');
                setSortBy('highest_utilization');
              }}
              className="px-4 py-2 bg-[#44312A] text-white rounded-xl text-xs font-bold hover:bg-[#34241E] transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((state) => (
              <div
                key={state.id}
                className="bg-white rounded-2xl border border-[#D8CBB6] p-6 shadow-sm hover:shadow-md hover:border-[#44312A]/40 transition-all duration-200 flex flex-col justify-between group space-y-5"
              >
                {/* Card Top: Name, Entity Type, Status */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-[#44312A] uppercase font-display group-hover:text-[#44312A] transition-colors">
                        {state.state}
                      </h3>
                      <div className="text-xs text-[#8C7769] mt-0.5">
                        {state.entity_type} · India
                      </div>
                    </div>
                    <StateStatusBadge status={state.status} />
                  </div>

                  {/* Financial Grid */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[#FAF7F2] rounded-xl border border-[#E7DDCA]/80">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Allocation</div>
                      <div className="text-sm font-black text-[#44312A] font-mono mt-0.5">
                        {formatCroresLakhs(state.allocated_amount).compact}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Expenditure</div>
                      <div className="text-sm font-black text-[#44312A] font-mono mt-0.5">
                        {formatCroresLakhs(state.total_expenditure).compact}
                      </div>
                    </div>
                  </div>

                  {/* Utilization Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-[#504F47] uppercase tracking-wider">Utilization</span>
                      <span className="font-mono font-bold text-[#44312A]">{state.utilization_percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-[#E7DDCA] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          state.utilization_percentage >= 45.0
                            ? 'bg-[#2D5A27]'
                            : state.utilization_percentage >= 25.0
                            ? 'bg-[#8C6D23]'
                            : 'bg-[#A83232]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, state.utilization_percentage))}%` }}
                      />
                    </div>
                  </div>

                  {/* Development Activity & Coverage */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#E7DDCA]">
                    <div>
                      <span className="text-[#8C7769] text-[11px]">Development Works:</span>
                      <div className="font-mono font-bold text-[#44312A] mt-0.5">
                        {state.total_works.toLocaleString()}{' '}
                        <span className="text-[10px] text-[#504F47] font-normal">
                          ({state.completed_works.toLocaleString()} completed)
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[#8C7769] text-[11px]">Parliamentary Reps:</span>
                      <div className="font-mono font-bold text-[#44312A] mt-0.5">
                        {state.mp_count} MPs
                      </div>
                    </div>
                  </div>

                  {/* Development Mix Category Pills */}
                  {state.development_mix && state.development_mix.length > 0 && (
                    <div className="pt-2 border-t border-[#E7DDCA] space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">
                        Development Mix
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {state.development_mix.map((cat, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FAF7F2] text-[#44312A] text-[10px] font-medium border border-[#D8CBB6]"
                          >
                            {cat.category}: {cat.percentage_cost}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Button */}
                <div className="pt-4 border-t border-[#E7DDCA]">
                  <button
                    onClick={() => navigate(`/states/${state.id}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#44312A] text-[#44312A] hover:text-white font-bold text-xs border border-[#D8CBB6] hover:border-transparent transition-all shadow-2xs group cursor-pointer"
                  >
                    <span>Explore State</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
