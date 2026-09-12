import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  ArrowRight,
  Briefcase,
  Users,
  RefreshCw,
  Compass,
  TrendingUp,
  ChevronRight,
  Info,
} from 'lucide-react';
import KPIGrid from '../components/dashboard/KPIGrid';
import ExpenditureChart from '../components/charts/ExpenditureChart';
import MapContainer from '../components/map/MapContainer';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ErrorState from '../components/ui/ErrorState';
import { getDashboard, getHealth } from '../services/api';
import { Link } from '../router/Router';
import { RISK_DISCLAIMER } from '../utils/riskLanguage';

export default function Dashboard({ onOpenSync = () => {} }) {
  const [dashboardData, setDashboardData] = useState(null);
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
      const [dashRes, healthRes] = await Promise.allSettled([
        getDashboard(),
        getHealth(5000),
      ]);

      if (dashRes.status === 'fulfilled') {
        setDashboardData(dashRes.value);
      } else {
        throw dashRes.reason;
      }

      if (healthRes.status === 'fulfilled') {
        setHealthStatus(healthRes.value);
      }
    } catch (err) {
      console.error('[Dashboard Load Error]:', err);
      setError(
        'Unable to load live dashboard aggregates from the JanDrishti backend. Please verify that the backend is running on http://localhost:8000.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Civic intelligence core navigation cards
  const intelligencePillars = [
    {
      icon: Briefcase,
      title: 'Itemized Works Registry',
      tag: '591 Granular Works',
      description:
        'Explore individual developmental works across 21 constituencies with reported completed costs, completion dates, and executing district metadata.',
      link: '/works',
      actionText: 'Explore Works Registry',
    },
    {
      icon: Users,
      title: 'MP Performance Dossiers',
      tag: '774 MPs Nationwide',
      description:
        'Review nationwide parliamentary financial ledgers, expenditure utilization ratios, unspent balances, and 5-factor portfolio risk breakdowns.',
      link: '/mps',
      actionText: 'Inspect MP Dossiers',
    },
    {
      icon: TrendingUp,
      title: 'Implementation Analytics',
      tag: 'Temporal & Cost Suite',
      description:
        'Analyze project cost distributions, parliamentary utilization tiers, official MoSPI benchmarks, and quarterly project completion velocity.',
      link: '/analytics',
      actionText: 'Open Analytics Suite',
    },
  ];

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      {/* 1. Hero Overview Banner */}
      <div className="rounded-3xl bg-white border border-[#D8CBB6] shadow-sm p-6 sm:p-8 lg:p-10 relative overflow-hidden flex flex-col justify-between">
        <div className="absolute -top-16 -left-16 w-80 h-80 bg-[#44312A]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-[#504F47]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Live Indicator Ribbon */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6]">
              <span className="h-2 w-2 rounded-full bg-[#44312A] animate-pulse" />
              <span>MPLADS PARLIAMENTARY INTELLIGENCE LAYER</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono text-[#44312A] bg-[#FAF7F2] border border-[#D8CBB6]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#44312A]" />
              <span>System Operational</span>
            </span>
          </div>

          {/* Display Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#44312A] font-display tracking-tight leading-[1.15]">
            From public data <span className="text-[#6B5145]">→ to public understanding.</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-sm sm:text-base text-[#504F47] font-normal leading-relaxed max-w-2xl">
            Turning public expenditure data into clear, explainable signals for better understanding and administrative review.
          </p>
        </div>

        {/* Action CTAs */}
        <div className="relative z-10 pt-6 mt-6 border-t border-[#D8CBB6] flex flex-wrap items-center justify-between gap-4">
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
              className="px-4 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] active:scale-95 text-[#44312A] font-bold text-xs border border-[#D8CBB6] flex items-center gap-2 transition duration-200 cursor-pointer shadow-xs"
            >
              <Users className="h-4 w-4 text-[#44312A]" />
              <span>MP Performance Dossiers</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#44312A]" />
            </Link>

            <Link
              to="/analytics"
              className="px-4 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] active:scale-95 text-[#44312A] font-bold text-xs border border-[#D8CBB6] flex items-center gap-2 transition duration-200 cursor-pointer shadow-xs"
            >
              <TrendingUp className="h-4 w-4 text-[#44312A]" />
              <span>Implementation Analytics</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#44312A]" />
            </Link>
          </div>

          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing || loading}
            className="p-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#504F47] hover:text-[#44312A] border border-[#D8CBB6] transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-2 text-xs font-mono"
            title="Refresh Data Layer"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-[#44312A]' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Error state if backend unreachable */}
      {error && (
        <ErrorState
          title="Backend Connection Notice"
          message={error}
          onRetry={() => loadDashboardData(false)}
        />
      )}

      {/* 2. Key Parliamentary Metrics Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-[#44312A]" />
            <span>Key Parliamentary Metrics</span>
          </h2>
          <span className="text-[11px] text-[#8C7769] font-mono">
            Live PostgreSQL Aggregates
          </span>
        </div>
        <KPIGrid dashboardData={dashboardData} loading={loading} />
      </section>

      {/* 3. Recharts Visual Section: Parliamentary Expenditure Velocity */}
      <section className="space-y-3">
        <ExpenditureChart dashboardData={dashboardData} loading={loading} />
      </section>

      {/* 4. Geospatial Project Intelligence Map */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-2">
            <Compass className="h-3.5 w-3.5 text-[#44312A]" />
            <span>Geospatial Project Intelligence Map</span>
          </h2>
          <span className="text-[11px] text-[#8C7769] font-mono">
            OpenStreetMap GIS Layer
          </span>
        </div>
        <MapContainer loading={loading} />
      </section>

      {/* 5. Civic Intelligence & Public Understanding Overview */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#44312A] tracking-tight font-display">
              Public Understanding & Oversight Pillars
            </h2>
            <p className="text-xs text-[#504F47] mt-0.5">
              Direct access into JanDrishti's core analytical modules and parliamentary registries.
            </p>
          </div>
          <Badge variant="primary" size="sm">
            CORE PLATFORM
          </Badge>
        </div>

        {/* 3 Core Navigation & Intelligence Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {intelligencePillars.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <Card
                key={i}
                className="p-5 flex flex-col justify-between hover:border-[#44312A] hover:shadow-md transition duration-200 group bg-white"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-9 w-9 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-[#44312A] group-hover:bg-[#44312A] group-hover:text-[#E7DDCA] transition">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6]">
                      {pillar.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#44312A] leading-tight">
                      {pillar.title}
                    </h3>
                    <p className="text-xs text-[#504F47] leading-relaxed mt-1.5">
                      {pillar.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-[#D8CBB6]">
                  <Link
                    to={pillar.link}
                    className="text-xs font-bold text-[#44312A] hover:underline inline-flex items-center gap-1 group-hover:text-[#34241E]"
                  >
                    <span>{pillar.actionText}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-[#8C7769] group-hover:text-[#44312A] transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Institutional Governance Disclaimer */}
        <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] text-xs text-[#504F47] flex items-start gap-3">
          <Info className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-[#44312A]">Civic Governance Notice: </strong>
            {RISK_DISCLAIMER} JanDrishti transforms official MoSPI e-SAKSHI data and parliamentary records into transparent indicators for administrative review.
          </p>
        </div>
      </section>
    </div>
  );
}
