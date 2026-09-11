import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { ChartSkeleton } from '../ui/Skeleton';
import { formatCroresLakhs } from '../../utils/formatting';

export default function ExpenditureChart({ dashboardData, loading = false }) {
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'area'

  if (loading || !dashboardData) {
    return <ChartSkeleton height={280} />;
  }

  const mps = dashboardData?.mps_summary || {};
  const works = dashboardData?.works_summary || {};

  // Financial aggregates
  const rawAllocated = mps.total_allocated_amount;
  const rawExpenditure = mps.total_expenditure !== null && mps.total_expenditure !== undefined
    ? mps.total_expenditure
    : works.total_cost;
  const rawUnspent = mps.total_unspent_amount;

  const allocatedCr = rawAllocated !== null && rawAllocated !== undefined
    ? Number((Number(rawAllocated) / 10000000).toFixed(2))
    : null;
  const expenditureCr = rawExpenditure !== null && rawExpenditure !== undefined
    ? Number((Number(rawExpenditure) / 10000000).toFixed(2))
    : null;
  const unspentCr = rawUnspent !== null && rawUnspent !== undefined
    ? Number((Number(rawUnspent) / 10000000).toFixed(2))
    : (allocatedCr !== null && expenditureCr !== null ? Math.max(0, Number((allocatedCr - expenditureCr).toFixed(2))) : null);

  // Data for Bar representation in strict Cream & Dark Brown palette
  const barData = [
    {
      name: 'Allocated Limit',
      amount: rawAllocated,
      amountCr: allocatedCr || 0,
      fill: '#44312A', // Dark Brown
    },
    {
      name: 'Total Expenditure',
      amount: rawExpenditure,
      amountCr: expenditureCr || 0,
      fill: '#504F47', // Charcoal Taupe
    },
    {
      name: 'Unspent Balance',
      amount: rawUnspent,
      amountCr: unspentCr || 0,
      fill: '#8C7769', // Muted Taupe
    },
  ];

  // Data for Area representation
  const areaData = [
    { stage: 'Parliamentary Entitlement', allocated: allocatedCr || 0, spent: 0, unspent: allocatedCr || 0 },
    { stage: 'Works Sanctioned', allocated: allocatedCr || 0, spent: Number(((expenditureCr || 0) * 0.5).toFixed(2)), unspent: Number(((allocatedCr || 0) - (expenditureCr || 0) * 0.5).toFixed(2)) },
    { stage: 'Executed & Verified', allocated: allocatedCr || 0, spent: expenditureCr || 0, unspent: unspentCr || 0 },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-2xl bg-white border border-[#D8CBB6] p-3.5 shadow-xl text-xs space-y-1.5 min-w-[180px]">
          <div className="font-bold text-[#44312A] border-b border-[#D8CBB6] pb-1">
            {label || payload[0]?.payload?.name}
          </div>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="text-[#504F47] capitalize flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                {entry.name || 'Amount'}:
              </span>
              <span className="text-[#44312A] font-mono font-bold">
                ₹{entry.value} Cr
              </span>
            </div>
          ))}
          {payload[0]?.payload?.amount !== undefined && payload[0]?.payload?.amount !== null && (
            <div className="text-[10px] text-[#504F47] pt-1 border-t border-[#D8CBB6] font-mono">
              Exact: {formatCroresLakhs(payload[0].payload.amount).exact}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>MP Allocation vs. Expenditure</CardTitle>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
              <button
                onClick={() => setChartType('bar')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                  chartType === 'bar'
                    ? 'bg-[#44312A] text-white shadow-xs'
                    : 'text-[#504F47] hover:text-[#44312A]'
                }`}
                title="Bar Chart View"
              >
                <BarChart3 className="h-3 w-3" />
                <span>Bar</span>
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                  chartType === 'area'
                    ? 'bg-[#44312A] text-white shadow-xs'
                    : 'text-[#504F47] hover:text-[#44312A]'
                }`}
                title="Area Outlay View"
              >
                <TrendingUp className="h-3 w-3" />
                <span>Area</span>
              </button>
            </div>
            <span className="text-[11px] font-mono text-[#504F47] hidden sm:inline">
              ₹ In Crores
            </span>
          </div>
        </div>
        <CardDescription>
          Comparison of cumulative parliamentary allocated limits, executed expenditures, and unspent balances.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8CBB6" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#504F47"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#D8CBB6' }}
                />
                <YAxis
                  stroke="#504F47"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#D8CBB6' }}
                  tickFormatter={(val) => `₹${val}Cr`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amountCr" name="Amount (Cr)" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAllocated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#44312A" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#44312A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#504F47" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#504F47" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8CBB6" vertical={false} />
                <XAxis
                  dataKey="stage"
                  stroke="#504F47"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#D8CBB6' }}
                />
                <YAxis
                  stroke="#504F47"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#D8CBB6' }}
                  tickFormatter={(val) => `₹${val}Cr`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="allocated"
                  name="Allocated Limit"
                  stroke="#44312A"
                  fillOpacity={1}
                  fill="url(#colorAllocated)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="spent"
                  name="Expenditure"
                  stroke="#504F47"
                  fillOpacity={1}
                  fill="url(#colorSpent)"
                  strokeWidth={2}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Bottom Comparative Metrics Bar */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#D8CBB6] text-center">
          <div>
            <div className="text-[10px] text-[#504F47] uppercase font-mono font-bold">Allocated Limit</div>
            <div className="text-xs sm:text-sm font-bold text-[#44312A] font-mono mt-0.5">
              {formatCroresLakhs(rawAllocated).compact}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#504F47] uppercase font-mono font-bold">Verified Spent</div>
            <div className="text-xs sm:text-sm font-bold text-[#44312A] font-mono mt-0.5">
              {formatCroresLakhs(rawExpenditure).compact}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#504F47] uppercase font-mono font-bold">Unspent Balance</div>
            <div className="text-xs sm:text-sm font-bold text-[#44312A] font-mono mt-0.5">
              {formatCroresLakhs(rawUnspent).compact}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
