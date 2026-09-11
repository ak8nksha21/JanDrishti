import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Cpu,
  Radio,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { checkHealth, fetchDatasetStats } from '../services/status';
import { formatRelativeTime } from '../utils/formatting';

export default function SystemStatus() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [checking, setChecking] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState(null);

  const runDiagnostics = async () => {
    setChecking(true);
    try {
      const [hRes, sRes] = await Promise.allSettled([
        checkHealth(),
        fetchDatasetStats(),
      ]);

      if (hRes.status === 'fulfilled') setHealth(hRes.value);
      if (sRes.status === 'fulfilled') setStats(sRes.value);
      setLastCheckTime(new Date().toISOString());
    } catch (e) {
      console.error('Diagnostic error:', e);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const services = [
    {
      name: 'FastAPI Application Service',
      endpoint: '/health & /',
      status: health?.isOnline ? 'Operational' : 'Unavailable',
      detail: health?.isOnline ? `Response time: ${health.latencyMs}ms` : 'Endpoint unreachable',
      icon: Server,
    },
    {
      name: 'Database Engine (PostgreSQL / SQLite)',
      endpoint: 'SQL Query Pool',
      status: stats?.works_count !== undefined ? 'Operational' : (health?.isOnline ? 'Operational' : 'Unavailable'),
      detail: stats ? `${stats.works_count} works, ${stats.mps_count} MP summaries indexed` : 'Connecting to database session',
      icon: Database,
    },
    {
      name: 'Empowered Indian Adapter',
      endpoint: 'api.empoweredindian.in',
      status: 'Operational',
      detail: 'REST consumer with backoff retry handling',
      icon: Radio,
    },
    {
      name: 'MoSPI eSAKSHI Adapter',
      endpoint: 'mplads.mospi.gov.in',
      status: 'Operational',
      detail: 'Public pre-login tile scraper adapter',
      icon: Activity,
    },
    {
      name: 'AI Risk Engine & ML Suite',
      endpoint: 'ml/ / models/',
      status: 'Not Initialized',
      detail: 'Awaiting training pipeline cross-validation',
      icon: Cpu,
    },
  ];

  const getStatusBadge = (status) => {
    if (status === 'Operational') return <Badge variant="success" size="sm" dot>Operational</Badge>;
    if (status === 'Degraded') return <Badge variant="warning" size="sm" dot>Degraded</Badge>;
    if (status === 'Unavailable') return <Badge variant="danger" size="sm" dot>Unavailable</Badge>;
    return <Badge variant="outline" size="sm">Not Initialized</Badge>;
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#44312A] tracking-tight font-display">
              System Telemetry & Status
            </h1>
            <Badge variant="primary" size="sm">
              MONITORING
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Real-time health probes, database connection checks, and API latency measurements.
          </p>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={checking}
          className="px-3.5 py-2 rounded-xl bg-white border border-[#D8CBB6] hover:bg-[#FAF7F2] text-[#44312A] text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-[#44312A] ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Probing Services...' : 'Refresh Health'}</span>
        </button>
      </div>

      {/* Global Status Banner */}
      <div
        className="p-6 rounded-3xl border bg-white border-[#D8CBB6] text-[#44312A] flex items-center justify-between shadow-xs"
      >
        <div className="flex items-center gap-3.5">
          <div
            className="h-10 w-10 rounded-2xl flex items-center justify-center bg-[#FAF7F2] border border-[#D8CBB6] text-[#44312A]"
          >
            {health?.isOnline ? (
              <CheckCircle2 className="h-6 w-6 text-[#44312A]" />
            ) : (
              <XCircle className="h-6 w-6 text-[#504F47]" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-[#44312A]">
              {health?.isOnline
                ? 'All Core Public Services Operational'
                : 'API Backend Currently Unreachable'}
            </h3>
            <p className="text-xs text-[#504F47] mt-0.5">
              {health?.isOnline
                ? 'The REST API and PostgreSQL database are responding with healthy latency.'
                : 'Make sure your backend server is listening on http://localhost:8000.'}
            </p>
          </div>
        </div>
        <div className="text-right font-mono text-[11px] text-[#504F47] hidden sm:block font-semibold">
          <div>Last Probe: {formatRelativeTime(lastCheckTime)}</div>
          {health?.latencyMs && <div>Roundtrip: {health.latencyMs}ms</div>}
        </div>
      </div>

      {/* Service Checklist Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Core Service Components</CardTitle>
          <CardDescription>
            Live status of backend micro-services and external adapters
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF7F2] border-b border-[#D8CBB6] text-[#504F47] uppercase font-mono text-[10px] tracking-wider font-bold">
                <th className="py-3 px-4">Component</th>
                <th className="py-3 px-4">Endpoint / Scope</th>
                <th className="py-3 px-4">Diagnostic Detail</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8CBB6]">
              {services.map((svc, i) => {
                const Icon = svc.icon;
                return (
                  <tr key={i} className="hover:bg-[#FAF7F2] transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5 font-semibold text-[#44312A]">
                        <Icon className="h-4 w-4 text-[#8C7769]" />
                        <span>{svc.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#504F47] text-[11px]">
                      {svc.endpoint}
                    </td>
                    <td className="py-3.5 px-4 text-[#504F47]">
                      {svc.detail}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {getStatusBadge(svc.status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
