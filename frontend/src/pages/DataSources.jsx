import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  ExternalLink,
  RefreshCw,
  Lock,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PipelineFlow from '../components/data-sources/PipelineFlow';
import ErrorState from '../components/ui/ErrorState';
import { fetchDashboardSummary } from '../services/dashboard';
import { formatIndianNumber } from '../utils/formatting';

export default function DataSources({ onOpenSync = () => {} }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSources = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDashboardSummary();
        setDashboardData(data);
      } catch (err) {
        console.error('Error fetching data sources:', err);
        setError('Unable to load data source status from backend.');
      } finally {
        setLoading(false);
      }
    };

    loadSources();
  }, []);

  const sources = dashboardData?.data_sources || {};
  const empowered = sources.empowered_indian || {};
  const mospi = sources.mospi_esakshi || {};

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#44312A] tracking-tight font-display">
              Data Sources & Ingestion Provenance
            </h1>
            <Badge variant="primary" size="sm">
              AUDIT TRAIL
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Transparent architecture, ingestion telemetry, and data sanitization guarantees.
          </p>
        </div>

        <button
          onClick={onOpenSync}
          className="px-4 py-2 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-[#44312A]/20 w-fit"
        >
          <RefreshCw className="h-3.5 w-3.5 text-[#E7DDCA]" />
          <span>Synchronize Feeds</span>
        </button>
      </div>

      {error && <ErrorState message={error} />}

      {/* Primary Data Source Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source A: Empowered Indian */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-[#44312A]">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>Empowered Indian Public Feed</CardTitle>
                  <span className="text-[10px] font-mono text-[#504F47]">
                    Source Type: Granular Completed Works & MP Summaries
                  </span>
                </div>
              </div>
              <Badge variant="success" size="sm" dot>
                ACTIVE INGESTION
              </Badge>
            </div>
            <CardDescription className="pt-2">
              Provides itemized completed works with descriptions, costs, completion dates, constituencies, MP details, categories, districts, and locations across India.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="text-[10px] uppercase font-mono text-[#504F47] block font-bold">
                  Ingested Completed Works
                </span>
                <span className="text-xl font-black font-mono text-[#44312A] mt-1 block">
                  {formatIndianNumber(empowered.ingested_works || dashboardData?.works_summary?.total_works || 0)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="text-[10px] uppercase font-mono text-[#504F47] block font-bold">
                  Ingested MP Summaries
                </span>
                <span className="text-xl font-black font-mono text-[#44312A] mt-1 block">
                  {formatIndianNumber(empowered.ingested_mps || dashboardData?.mps_summary?.total_mps || 0)}
                </span>
              </div>
            </div>

            <div className="text-xs text-[#504F47] space-y-1 pt-1 border-t border-[#D8CBB6] font-mono text-[11px]">
              <div>Endpoint: <code className="text-[#44312A]">https://api.empoweredindian.in/api/works/completed</code></div>
              <div>Rate Limit: Handled via exponential backoff adapter</div>
            </div>

            <a
              href="https://api.empoweredindian.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#44312A] font-bold hover:underline pt-1"
            >
              <span>Inspect Source Documentation</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Source B: MoSPI / e-SAKSHI */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-[#44312A]">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>MoSPI / e-SAKSHI Official Portal</CardTitle>
                  <span className="text-[10px] font-mono text-[#504F47]">
                    Source Type: National Macro Benchmark Indicators
                  </span>
                </div>
              </div>
              <Badge
                variant={mospi.status === 'active' ? 'success' : 'outline'}
                size="sm"
              >
                {mospi.status === 'active' ? 'CONNECTED' : 'STANDBY ADAPTER'}
              </Badge>
            </div>
            <CardDescription className="pt-2">
              Ministry of Statistics and Programme Implementation official portal (`mplads.mospi.gov.in`) unauthenticated pre-login REST endpoints.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="text-[10px] uppercase font-mono text-[#504F47] block font-bold">
                  Tracked Macro Indicators
                </span>
                <span className="text-xl font-black font-mono text-[#44312A] mt-1 block">
                  {mospi.macro_metrics_tracked || Object.keys(dashboardData?.macro_indicators || {}).length || 5} Metrics
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="text-[10px] uppercase font-mono text-[#504F47] block font-bold">
                  Endpoint Protocol
                </span>
                <span className="text-sm font-bold font-mono text-[#44312A] mt-1 block">
                  HTTPS REST (JSON)
                </span>
              </div>
            </div>

            <div className="text-xs text-[#504F47] space-y-1 pt-1 border-t border-[#D8CBB6] font-mono text-[11px]">
              <div>Portal Host: <code className="text-[#44312A]">mplads.mospi.gov.in</code></div>
              <div>Adapter Module: <code className="text-[#44312A]">app/services/ingestion/sources/mospi_esakshi.py</code></div>
            </div>

            <a
              href="https://mplads.mospi.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#44312A] font-bold hover:underline pt-1"
            >
              <span>Visit Official MoSPI Portal</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Visual Data Processing Pipeline */}
      <PipelineFlow />

      {/* PII Sanitization & Security Commitments */}
      <Card className="p-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[#44312A] flex items-center gap-2 mb-3 font-display">
          <Lock className="h-4 w-4 text-[#44312A]" />
          <span>Automated Privacy & Data Sanitization Guarantees</span>
        </h3>
        <p className="text-xs text-[#504F47] leading-relaxed max-w-4xl">
          To comply with public data protection standards, all ingested records undergo automated regex sanitization in{' '}
          <code className="bg-[#FAF7F2] border border-[#D8CBB6] px-1.5 py-0.5 rounded-lg font-mono text-[#44312A]">app/services/ingestion/validation.py</code>.
          Any incidental phone numbers, mobile sequences, personal email addresses, or unverified contact signatures contained in public project descriptions or location texts are permanently stripped prior to relational persistence and API exposure.
        </p>
      </Card>
    </div>
  );
}
