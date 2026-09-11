import React from 'react';
import { Database } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Database,
  title = 'No records available',
  description = 'The database does not currently contain records matching the requested parameters.',
  action = null,
  isAiModule = false,
  className = '',
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-[#D8CBB6] bg-white p-10 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div
        className={`h-12 w-12 rounded-xl flex items-center justify-center mb-3.5 bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6]`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="text-base font-bold text-[#44312A]">{title}</h4>
      <p className="text-xs text-[#504F47] max-w-md mt-1.5 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
