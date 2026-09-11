import React, { useState } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart3,
  Database,
  Activity,
  Search,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import { Link, useRouter } from '../../router/Router';
import { formatRelativeTime } from '../../utils/formatting';

/**
 * Bespoke JanDrishti Logo Emblem
 * Represents "Drishti" (The Civic Vision / Public Eye) merged with the Parliamentary Pillar
 */
function JanDrishtiLogo({ className = "h-9 w-9 sm:h-10 sm:w-10" }) {
  return (
    <div className={`${className} rounded-2xl bg-[#44312A] p-2 flex items-center justify-center shadow-md shadow-[#44312A]/25 border border-[#504F47] group-hover:scale-105 transition-all duration-300 relative overflow-hidden shrink-0`}>
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#6B5145]/40 via-transparent to-black/20 pointer-events-none" />
      
      {/* Custom Vector Icon: Drishti Eye + Parliamentary Pillars + Civic Lens */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full text-[#E7DDCA] relative z-10"
      >
        {/* Outer Drishti Optical Contour */}
        <path
          d="M2.5 16C5.5 9.5 10.5 5.5 16 5.5C21.5 5.5 26.5 9.5 29.5 16C26.5 22.5 21.5 26.5 16 26.5C10.5 26.5 5.5 22.5 2.5 16Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Inner Geometric Aperture / Iris */}
        <circle
          cx="16"
          cy="16"
          r="6"
          stroke="currentColor"
          strokeWidth="1.75"
          fill="#44312A"
        />
        {/* Center Parliamentary Core Pillar */}
        <path
          d="M16 11V21M13.5 12.5H18.5M13.5 19.5H18.5"
          stroke="#FAF7F2"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        {/* Radial Alignment Nodes */}
        <circle cx="16" cy="16" r="1.5" fill="#FAF7F2" />
        <circle cx="7" cy="16" r="1" fill="currentColor" />
        <circle cx="25" cy="16" r="1" fill="currentColor" />
      </svg>
    </div>
  );
}

export default function TopNavbar({
  onOpenSearch = () => {},
  onOpenSync = () => {},
  isSyncing = false,
  apiStatus = { isOnline: true, latencyMs: 18 },
  lastSyncTime = null,
}) {
  const { path } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {
      label: 'Overview',
      to: '/',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: 'Works Explorer',
      to: '/works',
      icon: Briefcase,
      badge: null,
    },
    {
      label: 'MP Performance',
      to: '/mps',
      icon: Users,
      badge: null,
    },
    {
      label: 'Analytics',
      to: '/analytics',
      icon: BarChart3,
      badge: null,
    },
    {
      label: 'Data Sources',
      to: '/data-sources',
      icon: Database,
      badge: null,
    },
    {
      label: 'System Status',
      to: '/status',
      icon: Activity,
      badge: apiStatus.isOnline ? 'Live' : 'Offline',
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-xl border-b border-[#D8CBB6] shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-4">
          
          {/* 1. Left: Brand Identity & Bespoke Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-3 group">
              <JanDrishtiLogo />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-wider text-base sm:text-lg text-[#44312A] font-display">
                    JAN<span className="text-[#504F47]">DRISHTI</span>
                  </span>
                  <span className="hidden sm:inline-block text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6]">
                    CIVIC AI
                  </span>
                </div>
                <p className="hidden md:block text-[10px] font-medium text-[#504F47] tracking-tight">
                  MPLADS Parliamentary Intelligence Layer
                </p>
              </div>
            </Link>
          </div>

          {/* 2. Center: Desktop Top Navigation Links (Centered Alignment) */}
          <div className="hidden lg:flex flex-1 items-center justify-center px-4">
            <nav className="flex items-center gap-1 xl:gap-1.5 p-1 bg-[#FAF7F2] rounded-2xl border border-[#D8CBB6] shadow-2xs">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.to === '/' ? path === '/' : path.startsWith(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 relative group cursor-pointer ${
                      isActive
                        ? 'bg-[#44312A] text-[#E7DDCA] shadow-sm'
                        : 'text-[#504F47] hover:text-[#44312A] hover:bg-[#E7DDCA]/50'
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 transition-colors ${
                        isActive
                          ? 'text-[#E7DDCA]'
                          : 'text-[#504F47] group-hover:text-[#44312A]'
                      }`}
                    />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                          isActive
                            ? 'bg-[#504F47] text-[#E7DDCA]'
                            : 'bg-[#E7DDCA] text-[#44312A]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* 3. Right: Search, Live Status, Sync Action, and Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Global Search Trigger */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] hover:border-[#44312A] text-[#504F47] hover:text-[#44312A] text-xs transition duration-200 cursor-pointer shadow-xs"
              title="Global Search (⌘K)"
            >
              <Search className="h-3.5 w-3.5 text-[#504F47]" />
              <span className="hidden xl:inline">Search...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-[#E7DDCA] rounded-md text-[#44312A] border border-[#D8CBB6]">
                ⌘K
              </kbd>
            </button>

            {/* Live Data Probe Telemetry */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] text-[11px] font-mono">
              <span
                className={`h-2 w-2 rounded-full ${
                  apiStatus.isOnline
                    ? 'bg-[#44312A] shadow-xs animate-pulse'
                    : 'bg-transparent border border-[#44312A]'
                }`}
              />
              <span className="text-[#504F47] hidden md:inline">
                {apiStatus.isOnline ? 'PostgreSQL' : 'Offline'}
              </span>
              <span className="text-[#44312A] font-bold">
                {apiStatus.isOnline ? `${apiStatus.latencyMs || 18}ms` : 'Err'}
              </span>
            </div>

            {/* Data Sync Action Button */}
            <button
              onClick={onOpenSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] border border-[#44312A] transition cursor-pointer active:scale-95 disabled:opacity-50 shadow-xs"
              title="Synchronize Live Feeds"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#E7DDCA] ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden sm:inline font-mono">
                {isSyncing ? 'Syncing...' : 'Sync'}
              </span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-xl text-[#44312A] bg-[#FAF7F2] border border-[#D8CBB6] hover:bg-[#E7DDCA] transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-[#44312A]" />
              ) : (
                <Menu className="h-5 w-5 text-[#44312A]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Mobile Dropdown Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#D8CBB6] bg-white/98 backdrop-blur-xl px-4 pt-3 pb-5 space-y-2 animate-in slide-in-from-top-2 duration-200 shadow-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#504F47] px-3 pt-1">
            Navigation Menu
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === '/' ? path === '/' : path.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-[#44312A] text-[#E7DDCA] shadow-xs'
                      : 'text-[#504F47] hover:text-[#44312A] hover:bg-[#E7DDCA]/60 border border-[#D8CBB6]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-[#E7DDCA]' : 'text-[#504F47]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-[#504F47] text-[#E7DDCA]'
                          : 'bg-[#E7DDCA] text-[#44312A]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#D8CBB6] flex items-center justify-between text-xs text-[#504F47] px-1">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <span
                className={`h-2 w-2 rounded-full ${
                  apiStatus.isOnline ? 'bg-[#44312A]' : 'bg-transparent border border-[#44312A]'
                }`}
              />
              <span>API: {apiStatus.isOnline ? 'Operational' : 'Unavailable'}</span>
            </span>
            <span className="font-mono text-[10px] text-[#504F47]">
              {lastSyncTime ? formatRelativeTime(lastSyncTime) : 'Session Active'}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
