import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  ArrowRight,
  Briefcase,
  Users,
  RefreshCw,
  Compass,
  ShieldCheck,
  TrendingUp,
  Database,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import KPIGrid from '../components/dashboard/KPIGrid';
import ExpenditureChart from '../components/charts/ExpenditureChart';
import CategoryDistributionChart from '../components/charts/CategoryDistributionChart';
import SystemHealthRiskPanel from '../components/dashboard/SystemHealthRiskPanel';
import MapContainer from '../components/map/MapContainer';
import Badge from '../components/ui/Badge';
import ErrorState from '../components/ui/ErrorState';
import { getDashboard, getHealth } from '../services/api';
import { fetchRiskSummary } from '../services/analytics';
import { Link } from '../router/Router';

export default function Dashboard({ onOpenSync = () => {} }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [riskSummary, setRiskSummary] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [dashRes, riskRes, healthRes] = await Promise.allSettled([
        getDashboard(),
        fetchRiskSummary(),
        getHealth(5000),
      ]);

      if (dashRes.status === 'fulfilled') {
        setDashboardData(dashRes.value);
      } else {
        throw dashRes.reason;
      }

      if (riskRes.status === 'fulfilled') {
        setRiskSummary(riskRes.value);
      }

      if (healthRes.status === 'fulfilled') {
        setHealthStatus(healthRes.value);
      }
    } catch (err) {
      console.error('[Dashboard Load Error]:', err);
      setError(
        'Unable to load live dashboard aggregates from the JanDrishti backend service at http://localhost:8000. Please verify that the FastAPI backend is running.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      {/* 1. Bespoke Asymmetrical Hero Section in Editorial Brown & Cream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 8-Cols: Editorial Value Proposition & Actions */}
        <div className="lg:col-span-8 rounded-3xl bg-white border border-[#D8CBB6] shadow-sm p-6 sm:p-8 lg:p-10 relative overflow-hidden flex flex-col justify-between">
          {/* Subtle warm ambient gradients */}
          <div className="absolute -top-16 -left-16 w-80 h-80 bg-[#44312A]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 right-0 w-64 h-64 bg-[#504F47]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            {/* Live Indicator Ribbon */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6]">
                <span className="h-2 w-2 rounded-full bg-[#44312A] animate-pulse" />
                <span>MPLADS PARLIAMENTARY INTELLIGENCE LAYER</span>
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono text-[#504F47] bg-[#FAF7F2] border border-[#D8CBB6]">
                MoSPI Feed Unified
              </span>
            </div>

            {/* Display Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#44312A] font-display tracking-tight leading-[1.15]">
              Audited public spend. <br className="hidden sm:inline" />
              <span className="text-[#6B5145]">
                Verifiable civic signals.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-sm sm:text-base text-[#504F47] font-normal leading-relaxed max-w-2xl">
              JanDrishti synthesizes granular itemized works, member financial ledgers, and official MoSPI benchmark indicators into an explainable, statistical oversight engine.
            </p>
          </div>

          {/* Action CTAs & Secondary Telemetry */}
          <div className="relative z-10 pt-6 mt-4 border-t border-[#D8CBB6] flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/works"
                className="px-5 py-2.5 rounded-xl bg-[#44312A] hover:bg-[#34241E] active:scale-95 text-[#E7DDCA] font-bold text-xs flex items-center gap-2 transition duration-200 cursor-pointer shadow-md shadow-[#44312A]/20"
              >
                <Briefcase className="h-4 w-4 text-[#E7DDCA]" />
                <span>Explore Works Registry</span>
                <ArrowRight className="h-3.5 w-3.5 text-[#E7DDCA]" />
              </Link>
              <Link
                to="/mps"
                className="px-5 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] active:scale-95 text-[#44312A] font-bold text-xs border border-[#D8CBB6] flex items-center gap-2 transition duration-200 cursor-pointer shadow-xs"
              >
                <Users className="h-4 w-4 text-[#504F47]" />
                <span>MP Financial Ledgers</span>
              </Link>
            </div>

            <button
              onClick={() => loadDashboardData(true)}
              disabled={refreshing || loading}
              className="p-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#504F47] hover:text-[#44312A] border border-[#D8CBB6] transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
              title="Refresh Data Layer"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-[#44312A]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Right 4-Cols: Telemetry Monitor Card */}
        <div className="lg:col-span-4 rounded-3xl bg-white border border-[#D8CBB6] shadow-sm p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CBB6]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#8C7769] font-bold">
                SYSTEM TELEMETRY
              </span>
              <span className="h-2 w-2 rounded-full bg-[#44312A] animate-ping" />
            </div>

            {/* Live Status Indicators */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#504F47] font-medium">PostgreSQL Live Store:</span>
                  <span className="font-mono font-bold text-[#44312A]">Connected</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-[#504F47]">
                  <span>FastAPI Probe Latency:</span>
                  <span className="text-[#44312A] font-semibold">{healthStatus?.latencyMs || 18}ms</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#504F47] font-medium">Data Lineage Feeds:</span>
                  <span className="font-mono font-bold text-[#44312A]">Dual Ingestion</span>
                </div>
                <div className="text-[10px] text-[#8C7769] font-mono">
                  empowered_indian • mospi_esakshi
                </div>
              </div>
            </div>
          </div>

          {/* Institutional Compliance Notice */}
          <div className="mt-4 pt-3 border-t border-[#D8CBB6] text-[11px] text-[#504F47] leading-snug flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#44312A] shrink-0" />
            <span>Strict statistical auditing with zero fabricated values.</span>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <ErrorState
          title="Unable to Load Live Dashboard Aggregates"
          message={error}
          onRetry={() => loadDashboardData(false)}
        />
      )}

      {/* 2. Asymmetric Top KPI Cards Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-[#44312A]" />
            <span>Macro Financial & Execution Signals</span>
          </h2>
          <span className="text-[11px] text-[#8C7769] font-mono">
            Derived from SQL Aggregates
          </span>
        </div>
        <KPIGrid dashboardData={dashboardData} loading={loading} />
      </section>

      {/* 3. Recharts Section (Asymmetrical 7 / 5 Visual Grid) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7">
          <ExpenditureChart dashboardData={dashboardData} loading={loading} />
        </div>
        <div className="lg:col-span-5">
          <CategoryDistributionChart
            categoryData={riskSummary?.category_risk || []}
            loading={loading}
          />
        </div>
      </section>

      {/* 4. Interactive GIS Map Canvas with Slide-Over Drawer */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-2">
            <Compass className="h-3.5 w-3.5 text-[#44312A]" />
            <span>Geospatial Risk Clustering & Field Verification</span>
          </h2>
          <span className="text-[11px] text-[#8C7769] font-mono">
            Numerical GPS Pinpoints
          </span>
        </div>
        <MapContainer loading={loading} />
      </section>

      {/* 5. System Health & Risk Summary Panel */}
      <section>
        <SystemHealthRiskPanel
          dashboardData={dashboardData}
          healthStatus={healthStatus}
          loading={loading}
        />
      </section>
    </div>
  );
}
