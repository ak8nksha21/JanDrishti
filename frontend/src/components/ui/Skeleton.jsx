import React from 'react';

export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[#D8CBB6]/40 ${className}`}
    />
  );
}

export function KPICardSkeleton() {
  return (
    <div className="rounded-3xl border border-[#D8CBB6] bg-white p-5 space-y-3 shadow-xs">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-9 rounded-2xl" />
      </div>
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-44" />
    </div>
  );
}

export const KPISkeleton = KPICardSkeleton;

export function TableRowSkeleton({ cols = 6 }) {
  return (
    <tr className="border-b border-[#D8CBB6]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="rounded-3xl border border-[#D8CBB6] bg-white overflow-hidden shadow-xs">
      <div className="p-4 border-b border-[#D8CBB6] flex items-center justify-between bg-[#FAF7F2]">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-32 rounded-xl" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#D8CBB6] bg-[#FAF7F2]">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="p-3 text-left">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} cols={cols} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 'h-64' }) {
  return (
    <div className="rounded-3xl border border-[#D8CBB6] bg-white p-5 space-y-4 shadow-xs">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className={`${height} w-full flex items-end gap-2 pt-8`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="w-full rounded-t-xl"
            style={{ height: `${25 + ((i * 17) % 70)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
