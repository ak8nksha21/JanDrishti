import React, { useEffect, useState } from 'react';
import { FileText, Shield, User, Clock, Terminal } from 'lucide-react';
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
    <div className="bg-white rounded-xl border border-[#EAE3D8] shadow-xs overflow-hidden text-xs">
      <div className="p-4 border-b border-[#EAE3D8] bg-[#FAF7F2] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-[#8B5A2B]" />
          <h3 className="font-semibold text-[#231815] text-sm">System & Decision Audit Trail</h3>
        </div>
        <span className="text-[11px] text-[#7A685D]">Immutable governance log (TRD Section 13)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#FAF7F2] border-b border-[#EAE3D8] text-[#7A685D] uppercase font-semibold text-[10px] tracking-wider">
              <th className="py-2.5 px-4">Timestamp</th>
              <th className="py-2.5 px-3">User / Officer</th>
              <th className="py-2.5 px-3">Action</th>
              <th className="py-2.5 px-3">Target Resource</th>
              <th className="py-2.5 px-4">Audit Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAE3D8] font-mono text-[11px]">
            {loading ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-[#8C7A70] font-sans">
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-[#8C7A70] font-sans">
                  No audit records logged yet.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-[#FAF7F2] transition-colors">
                  <td className="py-2.5 px-4 text-[#7A685D] whitespace-nowrap">
                    {l.created_at ? new Date(l.created_at).toLocaleString() : 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 text-[#231815] font-sans font-medium">
                    {l.user_id}
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <span className="px-2 py-0.5 rounded bg-[#FAF7F2] text-[#8B5A2B] font-semibold border border-[#EAE3D8] text-[10px]">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#231815]">
                    {l.resource_type}:{l.resource_id}
                  </td>
                  <td className="py-2.5 px-4 text-[#7A685D] max-w-md truncate">
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
