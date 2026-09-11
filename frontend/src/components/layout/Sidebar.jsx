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
    <div className="flex flex-col h-full bg-[#FAF7F2] border-r border-[#EAE3D8] w-64 text-[#231815] select-none">
      {/* Platform Branding Header */}
      <div className="p-5 border-b border-[#EAE3D8] flex items-center justify-between bg-white">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-lg bg-[#3E2723] flex items-center justify-center shadow-sm text-white font-black text-lg group-hover:bg-[#2A1A17] transition-all">
            <Shield className="h-5 w-5 text-amber-200 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-wider text-base text-[#231815]">
                JAN<span className="text-[#8B5A2B]">DRISHTI</span>
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-widest px-1 py-0.5 rounded bg-[#F3EDE2] text-[#8B5A2B] border border-[#EAE3D8]">
                v0.2
              </span>
            </div>
            <p className="text-[11px] font-medium text-[#7A685D] tracking-tight">
              MPLADS Intelligence Platform
            </p>
          </div>
        </Link>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 text-[#7A685D] hover:text-[#231815] rounded-lg hover:bg-[#F3EDE2]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#8C7A70]">
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
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-[#3E2723] text-white shadow-xs font-semibold'
                  : 'text-[#5C4A3E] hover:text-[#231815] hover:bg-[#F3EDE2] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive
                      ? 'text-amber-200'
                      : 'text-[#8C7A70] group-hover:text-[#3E2723]'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded tracking-wide font-medium ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[#EAE3D8] text-[#5C4A3E]'
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
      <div className="p-3 border-t border-[#EAE3D8] bg-white space-y-2.5">
        <div className="rounded-lg border border-[#EAE3D8] bg-[#FAF7F2] p-2.5 space-y-2">
          {/* API Health */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#7A685D] text-[11px] flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  apiStatus.isOnline
                    ? 'bg-[#3E5C38] shadow-xs'
                    : 'bg-[#8A2616]'
                }`}
              />
              Backend API
            </span>
            <span
              className={`text-[11px] font-mono font-semibold ${
                apiStatus.isOnline ? 'text-[#3E5C38]' : 'text-[#8A2616]'
              }`}
            >
              {apiStatus.isOnline
                ? `${apiStatus.latencyMs || 24}ms`
                : 'Offline'}
            </span>
          </div>

          {/* Synchronization status */}
          <div className="flex items-center justify-between text-[11px] text-[#7A685D] pt-1 border-t border-[#EAE3D8]">
            <span>Last Sync</span>
            <span className="text-[#231815] font-mono text-[10px] font-medium">
              {lastSyncTime ? formatRelativeTime(lastSyncTime) : 'Session Active'}
            </span>
          </div>
        </div>

        {/* Sync Trigger Action */}
        <button
          onClick={onOpenSync}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#3E2723] hover:bg-[#2A1A17] active:scale-[0.98] text-white border border-[#3E2723] text-xs font-medium transition cursor-pointer shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5 text-amber-200" />
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
            className="fixed inset-0 bg-[#231815]/60 backdrop-blur-xs transition-opacity"
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
