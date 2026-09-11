import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { ChartSkeleton } from '../ui/Skeleton';
import { formatCroresLakhs, formatIndianNumber } from '../../utils/formatting';

const CATEGORY_COLORS = [
  '#44312A', // Deep Dark Brown
  '#504F47', // Charcoal Taupe
  '#6B5145', // Warm Mocha
  '#8C7769', // Muted Taupe
  '#A69282', // Sand Taupe
  '#BAAA92', // Warm Sand
  '#CFC0A7', // Light Sand
  '#D8CBB6', // Border Cream
];

export default function CategoryDistributionChart({
  categoryData = [],
  loading = false,
}) {
  const [activeIndex, setActiveIndex] = useState(null);

  if (loading) {
    return <ChartSkeleton height={280} />;
  }

  // Filter out invalid items and slice top categories
  const data = Array.isArray(categoryData) && categoryData.length > 0
    ? categoryData.filter((item) => item && (item.works_count > 0 || item.count > 0))
    : [];

  const normalizedData = data.map((item) => ({
    category: item.category || 'General/Other',
    works_count: Number(item.works_count || item.count || 0),
    total_cost: item.total_cost !== null && item.total_cost !== undefined ? Number(item.total_cost) : null,
    avg_risk: item.avg_risk !== null && item.avg_risk !== undefined ? Number(item.avg_risk) : null,
  }));

  const totalWorks = normalizedData.reduce((acc, curr) => acc + curr.works_count, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct = totalWorks > 0 ? ((item.works_count / totalWorks) * 100).toFixed(1) : '0';
      return (
        <div className="rounded-2xl bg-white border border-[#D8CBB6] p-3.5 shadow-xl text-xs space-y-1.5 min-w-[190px]">
          <div className="font-bold text-[#44312A] border-b border-[#D8CBB6] pb-1 flex items-center justify-between gap-2">
            <span className="truncate">{item.category}</span>
            <span className="text-[#44312A] font-mono font-bold">{pct}%</span>
          </div>
          <div className="flex items-center justify-between text-[#504F47]">
            <span>Total Works:</span>
            <span className="font-mono font-bold text-[#44312A]">{formatIndianNumber(item.works_count)}</span>
          </div>
          {item.total_cost !== null && (
            <div className="flex items-center justify-between text-[#504F47]">
              <span>Total Outlay:</span>
              <span className="font-mono text-[#44312A] font-bold">
                {formatCroresLakhs(item.total_cost).compact}
              </span>
            </div>
          )}
          {item.avg_risk !== null && (
            <div className="flex items-center justify-between text-[#504F47]">
              <span>Avg Risk Signal:</span>
              <span className="font-mono text-[#44312A] font-bold">
                {item.avg_risk.toFixed(1)} / 100
              </span>
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
          <CardTitle>Works Distribution by Category</CardTitle>
          <span className="text-[11px] font-mono text-[#504F47]">
            {totalWorks > 0 ? `${formatIndianNumber(totalWorks)} Works` : 'N/A'}
          </span>
        </div>
        <CardDescription>
          Sector-wise breakdown of itemized developmental projects and expenditure coverage.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-2">
        {normalizedData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <p className="text-xs text-[#504F47] font-semibold">
              No category distribution records loaded yet.
            </p>
            <span className="text-[11px] text-[#504F47] mt-1">
              Synchronize data from the Works Registry to populate sector charts.
            </span>
          </div>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={normalizedData}
                    dataKey="works_count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {normalizedData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        stroke="#FFFFFF"
                        strokeWidth={activeIndex === index ? 3 : 1.5}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.65}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend Grid */}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-[#D8CBB6] text-xs">
              {normalizedData.slice(0, 4).map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 truncate p-1.5 rounded-lg transition ${
                    activeIndex === idx ? 'bg-[#E7DDCA]/60' : ''
                  }`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                  />
                  <span className="text-[#44312A] font-medium truncate text-[11px]" title={item.category}>
                    {item.category}
                  </span>
                  <span className="text-[#504F47] font-mono text-[10px] ml-auto shrink-0 font-semibold">
                    {formatIndianNumber(item.works_count)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
