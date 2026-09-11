import React from 'react';

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[#EFE8DC] ${className}`}
      {...props}
    />
  );
}

export function KPISkeleton() {
  return (
    <div className="rounded-2xl border border-[#EAE3D8] bg-white p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-44" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 6 }) {
  return (
    <tr className="border-b border-[#EAE3D8]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <Skeleton className={`h-4 ${i === 0 ? 'w-16' : i === 1 ? 'w-48' : 'w-24'}`} />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div className="rounded-2xl border border-[#EAE3D8] bg-white overflow-hidden shadow-xs">
      <div className="p-4 border-b border-[#EAE3D8] flex items-center justify-between bg-[#FCFAF7]">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-64 rounded-xl" />
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#EAE3D8] bg-[#FAF7F2]">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="py-3.5 px-4 text-left">
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
  );
}

export function ChartSkeleton({ height = 280 }) {
  return (
    <div className="rounded-2xl border border-[#EAE3D8] bg-white p-5 space-y-4 shadow-xs">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-24 rounded" />
      </div>
      <div
        className="w-full flex items-end justify-between gap-3 pt-6 px-2"
        style={{ height }}
      >
        <Skeleton className="h-3/5 w-full rounded-t" />
        <Skeleton className="h-4/5 w-full rounded-t" />
        <Skeleton className="h-2/5 w-full rounded-t" />
        <Skeleton className="h-5/6 w-full rounded-t" />
        <Skeleton className="h-1/2 w-full rounded-t" />
        <Skeleton className="h-3/4 w-full rounded-t" />
      </div>
    </div>
  );
}
