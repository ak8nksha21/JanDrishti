import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { fetchAuditLogs } from '../api/client';

export default function AuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs()
      .then(res => {
        setLogs(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-[#D8CBB6] shadow-xs overflow-hidden text-xs">
      <div className="p-4 border-b border-[#D8CBB6] bg-[#FAF7F2] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-[#44312A]" />
          <h3 className="font-bold text-[#44312A] text-sm">System & Decision Audit Trail</h3>
        </div>
        <span className="text-[11px] text-[#504F47]">Immutable governance log (TRD Section 13)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#FAF7F2] border-b border-[#D8CBB6] text-[#504F47] uppercase font-bold text-[10px] tracking-wider">
              <th className="py-2.5 px-4">Timestamp</th>
              <th className="py-2.5 px-3">User / Officer</th>
              <th className="py-2.5 px-3">Action</th>
              <th className="py-2.5 px-3">Target Resource</th>
              <th className="py-2.5 px-4">Audit Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CBB6] font-mono text-[11px]">
            {loading ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-[#8C7769] font-sans">
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-[#8C7769] font-sans">
                  No audit records logged yet.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-[#FAF7F2] transition-colors">
                  <td className="py-2.5 px-4 text-[#504F47] whitespace-nowrap">
                    {l.created_at ? new Date(l.created_at).toLocaleString() : 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 text-[#44312A] font-sans font-medium">
                    {l.user_id}
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <span className="px-2 py-0.5 rounded bg-[#FAF7F2] text-[#44312A] font-semibold border border-[#D8CBB6] text-[10px]">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#44312A]">
                    {l.resource_type}:{l.resource_id}
                  </td>
                  <td className="py-2.5 px-4 text-[#504F47] max-w-md truncate">
                    {JSON.stringify(l.metadata)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
