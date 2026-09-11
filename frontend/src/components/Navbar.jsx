import React, { useState } from 'react';
import { Shield, RefreshCw, AlertTriangle, MapPin, Activity, FileText, CheckCircle2, UserCheck, Globe, Building2, Search } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, userRole, setUserRole, onSync, onLiveSync, isSyncing }) {
  const [constituencyInput, setConstituencyInput] = useState('RAE BARELI');

  const popularConstituencies = [
    { label: 'Rae Bareli', val: 'RAE BARELI' },
    { label: 'Shahjahanpur', val: 'SHAHJAHANPUR' },
    { label: 'Varanasi', val: 'VARANASI' },
    { label: 'Bareilly', val: 'BAREILLY' },
    { label: 'Lucknow', val: 'LUCKNOW' },
    { label: 'Patna Sahib', val: 'PATNA SAHIB' }
  ];

  const handleQuickSelect = (val) => {
    setConstituencyInput(val);
    if (onLiveSync) onLiveSync(val);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (onLiveSync) onLiveSync(constituencyInput);
    }
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
      {/* Tricolor top border accent */}
      <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-white to-emerald-600" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow-sm border border-blue-400/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">JanDrishti</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Decision Support • Early Warning System
                </span>
              </div>
              <p className="text-xs text-slate-400">
                AI-Powered MPLADS Risk Intelligence & Investigation Platform
              </p>

            </div>
          </div>

          {/* Role selector & Live API action */}
          <div className="flex items-center space-x-3">
            {/* Live API Search Box */}
            <div className="hidden md:flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 text-xs shadow-inner">
              <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] text-slate-400 font-medium">Live API:</span>
              <input
                type="text"
                value={constituencyInput}
                onChange={(e) => setConstituencyInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. RAE BARELI"
                className="bg-slate-900 px-2 py-0.5 rounded text-cyan-200 text-xs font-mono font-bold w-32 border border-slate-700 focus:outline-none focus:border-cyan-500 uppercase transition"
              />
              <button
                onClick={() => onLiveSync && onLiveSync(constituencyInput)}
                disabled={isSyncing}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-semibold transition disabled:opacity-50 cursor-pointer shadow-xs"
                title="Fetch live records from api.empoweredindian.in"
              >
                {isSyncing ? 'Fetching...' : 'Fetch'}
              </button>
            </div>

            {/* Role indicator */}
            <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400 hidden sm:inline">Role:</span>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="CENTRAL_OFFICER" className="bg-slate-900 text-white">Ministry / Central Officer</option>
                <option value="DISTRICT_OFFICER" className="bg-slate-900 text-white">District Collector / DPO</option>
                <option value="VIEWER" className="bg-slate-900 text-white">Public / Auditor</option>
              </select>
            </div>

            {/* Re-score Sync Button */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition-all cursor-pointer ${
                isSyncing 
                  ? 'bg-blue-800 text-blue-200 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/20'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Scoring...' : 'Re-score All'}</span>
            </button>
          </div>
        </div>

        {/* Popular Constituency Quick-Pills & Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-800/80 py-1.5 gap-2">
          <div className="flex space-x-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'overview' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('risk')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'risk' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Risk Table</span>
            </button>
            <button
              onClick={() => setActiveTab('agency')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'agency' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>eSAKSHI Benchmarks</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'map' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Geo Map</span>
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'alerts' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Alerts</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'audit' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Audit Log</span>
            </button>
          </div>

          {/* Quick-fetch pills */}
          <div className="hidden lg:flex items-center space-x-1.5 text-[11px]">
            <span className="text-slate-500 font-medium">Quick Live:</span>
            {popularConstituencies.map((c) => (
              <button
                key={c.val}
                onClick={() => handleQuickSelect(c.val)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 transition cursor-pointer"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
