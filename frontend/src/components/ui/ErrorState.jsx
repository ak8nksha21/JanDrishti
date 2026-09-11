import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorState({
  title = 'Unable to load information',
  message = 'The JanDrishti API service could not be reached or returned an unexpected response.',
  onRetry = null,
  className = '',
}) {
  return (
    <div
      className={`rounded-2xl border border-[#D8CBB6] bg-[#FAF7F2] p-8 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="h-11 w-11 rounded-xl bg-[#E7DDCA] border border-[#D8CBB6] text-[#44312A] flex items-center justify-center mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h4 className="text-sm font-bold text-[#44312A]">{title}</h4>
      <p className="text-xs text-[#504F47] max-w-md mt-1.5 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-xs font-semibold text-[#E7DDCA] shadow-xs transition cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5 text-[#E7DDCA]" />
          Retry Request
        </button>
      )}
    </div>
  );
}
