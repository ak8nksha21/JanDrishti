import React, { useState } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart3,
  Search,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import { Link, useRouter } from '../../router/Router';

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

  // Core Product Navigation Areas
  const navItems = [
    {
      label: 'Overview',
      to: '/',
      icon: LayoutDashboard,
    },
    {
      label: 'Works Explorer',
      to: '/works',
      icon: Briefcase,
    },
    {
      label: 'MP Performance',
      to: '/mps',
      icon: Users,
    },
    {
      label: 'Analytics',
      to: '/analytics',
      icon: BarChart3,
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

          {/* 2. Center: Desktop Top Navigation Links */}
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
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 relative group cursor-pointer ${
                      isActive
                        ? 'bg-[#44312A] text-[#E7DDCA] shadow-sm'
                        : 'text-[#504F47] hover:text-[#44312A] hover:bg-[#E7DDCA]/50'
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 transition-colors ${
                        isActive ? 'text-[#E7DDCA]' : 'text-[#504F47] group-hover:text-[#44312A]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* 3. Right: Interactive Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Global Search Shortcut (Cmd+K) */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] border border-[#D8CBB6] text-xs font-semibold text-[#504F47] hover:text-[#44312A] transition active:scale-95 shadow-2xs cursor-pointer"
              title="Search Works & MPs (Cmd+K / Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-[#44312A]" />
              <span className="hidden xl:inline text-[#504F47]">Quick Search</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold bg-white text-[#44312A] rounded border border-[#D8CBB6]">
                ⌘K
              </kbd>
            </button>

            {/* Sync Feeds Action Button */}
            <button
              onClick={onOpenSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] border border-[#D8CBB6] text-xs font-semibold text-[#44312A] transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Synchronize parliamentary feeds"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#44312A] ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Sync Data</span>
            </button>

            {/* Live Status Indicator Pill */}
            <div
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] text-[11px] font-mono font-semibold text-[#44312A] shadow-2xs"
              title="Live backend connectivity status"
            >
              <span className={`h-2 w-2 rounded-full ${apiStatus.isOnline ? 'bg-[#44312A] animate-pulse' : 'bg-[#504F47]'}`} />
              <span>{apiStatus.isOnline ? `${apiStatus.latencyMs || 18}ms` : 'Offline'}</span>
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-[#FAF7F2] text-[#44312A] hover:bg-[#E7DDCA] border border-[#D8CBB6] transition active:scale-95"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#D8CBB6] bg-white px-4 py-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <div className="font-bold text-[10px] uppercase tracking-wider text-[#8C7769] px-3">
            Core Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === '/' ? path === '/' : path.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[#44312A] text-[#E7DDCA]'
                    : 'text-[#504F47] hover:bg-[#FAF7F2]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}

