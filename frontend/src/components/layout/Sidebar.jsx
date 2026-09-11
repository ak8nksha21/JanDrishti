import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart3,
  Database,
  Activity,
  RefreshCw,
  ExternalLink,
  Shield,
  Layers,
  X,
  Radio,
} from 'lucide-react';
import { Link, useRouter } from '../../router/Router';
import Badge from '../ui/Badge';
import { formatRelativeTime } from '../../utils/formatting';

export default function Sidebar({
  isOpen = false,
  onClose = () => {},
  apiStatus = { isOnline: true, latencyMs: 0 },
  lastSyncTime = null,
  onOpenSync = () => {},
}) {
  const { path } = useRouter();

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
      badge: 'Validated',
    },
    {
      label: 'System Status',
      to: '/status',
      icon: Activity,
      badge: apiStatus.isOnline ? 'Active' : 'Offline',
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#FAF7F2] border-r border-[#D8CBB6] w-64 text-[#44312A] select-none">
      {/* Platform Branding Header */}
      <div className="p-5 border-b border-[#D8CBB6] flex items-center justify-between bg-white">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-[#44312A] flex items-center justify-center shadow-xs text-[#E7DDCA] font-black text-lg group-hover:bg-[#34241E] transition-all">
            <Shield className="h-5 w-5 text-[#E7DDCA] stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-wider text-base text-[#44312A] font-display">
                JAN<span className="text-[#504F47]">DRISHTI</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest px-1 py-0.5 rounded bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6]">
                v0.2
              </span>
            </div>
            <p className="text-[11px] font-medium text-[#504F47] tracking-tight">
              MPLADS Intelligence Platform
            </p>
          </div>
        </Link>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 text-[#504F47] hover:text-[#44312A] rounded-lg hover:bg-[#E7DDCA]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#504F47]">
          Platform Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.to === '/' ? path === '/' : path.startsWith(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-[#44312A] text-[#E7DDCA] shadow-xs font-semibold'
                  : 'text-[#504F47] hover:text-[#44312A] hover:bg-[#E7DDCA]/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive
                      ? 'text-[#E7DDCA]'
                      : 'text-[#504F47] group-hover:text-[#44312A]'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded tracking-wide font-medium ${
                    isActive
                      ? 'bg-[#504F47] text-[#E7DDCA]'
                      : 'bg-[#D8CBB6] text-[#44312A]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Operational Telemetry & Bottom Status */}
      <div className="p-3 border-t border-[#D8CBB6] bg-white space-y-2.5">
        <div className="rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] p-2.5 space-y-2">
          {/* API Health */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#504F47] text-[11px] flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  apiStatus.isOnline
                    ? 'bg-[#44312A] shadow-xs'
                    : 'bg-transparent border border-[#44312A]'
                }`}
              />
              Backend API
            </span>
            <span
              className="text-[11px] font-mono font-semibold text-[#44312A]"
            >
              {apiStatus.isOnline
                ? `${apiStatus.latencyMs || 24}ms`
                : 'Offline'}
            </span>
          </div>

          {/* Synchronization status */}
          <div className="flex items-center justify-between text-[11px] text-[#504F47] pt-1 border-t border-[#D8CBB6]">
            <span>Last Sync</span>
            <span className="text-[#44312A] font-mono text-[10px] font-medium">
              {lastSyncTime ? formatRelativeTime(lastSyncTime) : 'Session Active'}
            </span>
          </div>
        </div>

        {/* Sync Trigger Action */}
        <button
          onClick={onOpenSync}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#44312A] hover:bg-[#34241E] active:scale-[0.98] text-[#E7DDCA] border border-[#44312A] text-xs font-semibold transition cursor-pointer shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5 text-[#E7DDCA]" />
          <span>Synchronize Data</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#FAF7F2] shadow-2xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
