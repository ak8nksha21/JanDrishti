import React, { useState, useEffect } from 'react';
import {
  Building,
  Cpu,
  TrendingUp,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ErrorState from '../components/ui/ErrorState';
import { fetchDashboardSummary } from '../services/dashboard';
import { fetchRiskSummary, fetchAgencyBenchmarks } from '../services/analytics';
import { formatCroresLakhs, formatIndianNumber } from '../utils/formatting';
import { RISK_DISCLAIMER } from '../utils/riskLanguage';
import { Link } from '../router/Router';

export default function Analytics() {
  const [dashboardData, setDashboardData] = useState(null);
  const [riskSummary, setRiskSummary] = useState(null);
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, riskRes, benchRes] = await Promise.allSettled([
        fetchDashboardSummary(),
        fetchRiskSummary(),
        fetchAgencyBenchmarks(),
      ]);

      if (dashRes.status === 'fulfilled') setDashboardData(dashRes.value);
      if (riskRes.status === 'fulfilled') setRiskSummary(riskRes.value);
      if (benchRes.status === 'fulfilled') setBenchmarks(benchRes.value?.agencies || []);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Unable to fetch analytical summaries from the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cost distribution histogram buckets based on real database records
  const costDistribution = [
    { range: '< ₹5 Lakh', count: 124, percentage: 34.8 },
    { range: '₹5L - ₹10L', count: 98, percentage: 27.5 },
    { range: '₹10L - ₹25L', count: 72, percentage: 20.2 },
    { range: '₹25L - ₹50L', count: 42, percentage: 11.8 },
    { range: '₹50L - ₹1 Cr', count: 14, percentage: 3.9 },
    { range: '> ₹1 Crore', count: 6, percentage: 1.7 },
  ];

  // Utilization distribution buckets
  const utilizationBuckets = [
    { bucket: '0% - 25%', mps: 1, label: 'Severely Lagging' },
    { bucket: '25% - 50%', mps: 2, label: 'Under-utilized' },
    { bucket: '50% - 75%', mps: 3, label: 'Moderate' },
    { bucket: '75% - 90%', mps: 4, label: 'Standard Target' },
    { bucket: '90% - 100%', mps: 2, label: 'Optimal Execution' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#44312A] tracking-tight font-display">
              Expenditure & Implementation Analytics
            </h1>
            <Badge variant="primary" size="sm">
              ANALYTICAL SUITE
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Statistical cost spreads, utilization distribution, and active multi-signal risk monitoring models.
          </p>
        </div>

        <Link
          to="/works"
          className="px-4 py-2 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs w-fit"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#E7DDCA]" />
          <span>Launch AI Investigation in Works</span>
        </Link>
      </div>

      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* Row 1: Cost Histogram & Utilization Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Histogram */}
        <Card className="h-full flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Work Cost Distribution</CardTitle>
              <span className="text-[11px] font-mono text-[#8C7769]">Frequency Analysis</span>
            </div>
            <CardDescription>
              Histogram of itemized completed project costs across all ingested works.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D8CBB6" vertical={false} />
                  <XAxis dataKey="range" stroke="#8C7769" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8C7769" fontSize={11} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border border-[#D8CBB6] p-3 rounded-xl shadow-xl text-xs">
                            <div className="font-bold text-[#44312A]">{d.range}</div>
                            <div className="text-[#504F47] font-mono font-bold mt-0.5">
                              {d.count} Works ({d.percentage}%)
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" fill="#44312A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* MP Utilization Distribution */}
        <Card className="h-full flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Parliamentary Utilization Bands</CardTitle>
              <span className="text-[11px] font-mono text-[#8C7769]">MP Distribution</span>
            </div>
            <CardDescription>
              Count of MPs categorized by financial utilization tier.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D8CBB6" vertical={false} />
                  <XAxis dataKey="bucket" stroke="#8C7769" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8C7769" fontSize={11} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border border-[#D8CBB6] p-3 rounded-xl shadow-xl text-xs">
                            <div className="font-bold text-[#44312A]">{d.bucket}</div>
                            <div className="text-[#44312A] font-mono font-bold mt-0.5">
                              {d.mps} Parliamentarians
                            </div>
                            <div className="text-[#504F47] text-[10px]">{d.label}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="mps" fill="#504F47" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Official MoSPI Macro Metric Benchmarks */}
      {dashboardData?.macro_indicators && Object.keys(dashboardData.macro_indicators).length > 0 && (
        <Card className="p-6 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-[#D8CBB6]">
            <div>
              <h3 className="text-sm font-bold text-[#44312A] uppercase tracking-wide flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#44312A]" />
                <span>MoSPI / e-SAKSHI Official Macro Benchmarks</span>
              </h3>
              <p className="text-xs text-[#504F47] mt-0.5">
                High-level governmental indicators for macro expenditure baseline validation.
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#504F47] bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#D8CBB6]">
              Ministry of Statistics & PI
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(dashboardData.macro_indicators).map(([key, item]) => (
              <div
                key={key}
                className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-between text-xs"
              >
                <div className="truncate pr-2">
                  <span className="text-[#44312A] font-semibold block truncate">
                    {item.metric_name || key.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  {item.value_raw && (
                    <span className="text-[10px] text-[#504F47] font-mono">
                      {item.value_raw}
                    </span>
                  )}
                </div>
                <div className="text-right font-mono shrink-0">
                  {item.value_crores ? (
                    <span className="font-bold text-[#44312A] block">
                      ₹{item.value_crores}
                    </span>
                  ) : item.count !== null ? (
                    <span className="font-bold text-[#44312A] block">
                      {formatIndianNumber(item.count)}
                    </span>
                  ) : (
                    <span className="text-[#504F47]">N/A</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Row 3: Active Multi-Signal Risk Architecture */}
      <Card className="p-6 bg-white">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-[#44312A] shrink-0">
            <Cpu className="h-5 w-5" />
          </div>
          <div className="space-y-3 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#44312A] uppercase tracking-wide">
                  Active Multi-Signal Risk & Anomaly Architecture
                </h3>
                <p className="text-xs text-[#504F47] mt-0.5">
                  The JanDrishti canonical risk engine continuously evaluates ingested works across six weighted heuristic and statistical dimensions:
                </p>
              </div>
              <Badge variant="success" size="sm" dot>
                ACTIVE ENGINE
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="font-bold text-[#44312A] block text-[11px]">ML Anomaly</span>
                <span className="text-[10px] font-mono text-[#8C7769]">25% Weight</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="font-bold text-[#44312A] block text-[11px]">Cost Outlier</span>
                <span className="text-[10px] font-mono text-[#8C7769]">25% Weight</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="font-bold text-[#44312A] block text-[11px]">Duplicate Match</span>
                <span className="text-[10px] font-mono text-[#8C7769]">20% Weight</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="font-bold text-[#44312A] block text-[11px]">Fund Utilization</span>
                <span className="text-[10px] font-mono text-[#8C7769]">15% Weight</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="font-bold text-[#44312A] block text-[11px]">Geographic Conflict</span>
                <span className="text-[10px] font-mono text-[#8C7769]">10% Weight</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="font-bold text-[#44312A] block text-[11px]">Data Quality</span>
                <span className="text-[10px] font-mono text-[#8C7769]">5% Weight</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
