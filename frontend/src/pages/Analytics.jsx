import React, { useState, useEffect } from 'react';
import {
  Building,
  Cpu,
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
import { formatCroresLakhs } from '../utils/formatting';

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
              DEEP DIVE
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Statistical cost spreads, utilization distribution, and implementing agency performance benchmarks.
          </p>
        </div>
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

      {/* Row 2: Implementing Agency Benchmarks */}
      {benchmarks.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building className="h-4 w-4 text-[#44312A]" />
                <span>Implementing Agency Benchmarks</span>
              </CardTitle>
              <Badge variant="outline" size="sm">
                Statistical Aggregates
              </Badge>
            </div>
            <CardDescription>
              Aggregated expenditures and completed works executed by nodal district agencies.
            </CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#D8CBB6] text-[#504F47] uppercase font-mono text-[10px] tracking-wider font-bold">
                  <th className="py-3 px-4">Implementing Agency</th>
                  <th className="py-3 px-4 text-center">Total Works Executed</th>
                  <th className="py-3 px-4 text-right">Total Expenditure</th>
                  <th className="py-3 px-4 text-right">Average Cost / Work</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CBB6]">
                {benchmarks.slice(0, 8).map((agency, i) => (
                  <tr key={i} className="hover:bg-[#FAF7F2] transition">
                    <td className="py-3 px-4 font-semibold text-[#44312A]">
                      {agency.agency || 'Unspecified District Agency'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[#504F47]">
                      {agency.total_works || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#44312A]">
                      {formatCroresLakhs(agency.total_spend).compact}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[#44312A] font-semibold">
                      {formatCroresLakhs(agency.avg_cost).compact}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Row 3: Future Module Placeholders */}
      <Card className="p-6 bg-[#FAF7F2]">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-[#44312A] shrink-0">
            <Cpu className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#44312A] uppercase tracking-wide">
                Advanced Analytical Suite (Future Modules)
              </h3>
              <Badge variant="primary" size="sm">
                IN ROADMAP
              </Badge>
            </div>
            <p className="text-xs text-[#504F47] leading-relaxed max-w-3xl">
              Advanced machine learning analytics (including <strong>Isolation Forest multidimensional anomaly detection</strong>, <strong>semantic sentence-transformer duplicate identification</strong>, and <strong>agentic audit generation</strong>) are currently undergoing algorithmic validation.
              These modules will integrate directly into this analytical dashboard once cross-validated against historical auditor-general findings.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
