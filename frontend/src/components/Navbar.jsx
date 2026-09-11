import React, { useState } from 'react';
import { Shield, RefreshCw, AlertTriangle, MapPin, Activity, FileText, CheckCircle2, UserCheck, Globe, Building2 } from 'lucide-react';

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
    <header className="bg-white text-[#44312A] border-b border-[#D8CBB6] sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="p-2 bg-[#44312A] rounded-xl shadow-xs text-[#E7DDCA]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-[#44312A] font-display">JanDrishti</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6]">
                  Decision Support
                </span>
              </div>
              <p className="text-xs text-[#504F47]">
                AI-Powered MPLADS Risk Intelligence & Investigation Platform
              </p>
            </div>
          </div>

          {/* Role selector & Live API action */}
          <div className="flex items-center space-x-3">
            {/* Live API Search Box */}
            <div className="hidden md:flex items-center space-x-1.5 bg-[#FAF7F2] px-2.5 py-1 rounded-xl border border-[#D8CBB6] text-xs">
              <Globe className="w-3.5 h-3.5 text-[#504F47] shrink-0" />
              <span className="text-[11px] text-[#504F47] font-bold">Live API:</span>
              <input
                type="text"
                value={constituencyInput}
                onChange={(e) => setConstituencyInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. RAE BARELI"
                className="bg-white px-2 py-0.5 rounded-lg text-[#44312A] text-xs font-mono font-bold w-32 border border-[#D8CBB6] focus:outline-none focus:border-[#44312A] uppercase transition"
              />
              <button
                onClick={() => onLiveSync && onLiveSync(constituencyInput)}
                disabled={isSyncing}
                className="px-2.5 py-1 bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] rounded-lg text-[11px] font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                title="Fetch live records from api.empoweredindian.in"
              >
                {isSyncing ? 'Fetching...' : 'Fetch'}
              </button>
            </div>

            {/* Role indicator */}
            <div className="flex items-center space-x-2 bg-[#FAF7F2] px-3 py-1.5 rounded-xl border border-[#D8CBB6] text-xs">
              <UserCheck className="w-4 h-4 text-[#504F47]" />
              <span className="text-[#504F47] hidden sm:inline font-bold">Role:</span>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="bg-transparent text-[#44312A] font-semibold focus:outline-none cursor-pointer"
              >
                <option value="CENTRAL_OFFICER">Ministry / Central Officer</option>
                <option value="DISTRICT_OFFICER">District Collector / DPO</option>
                <option value="VIEWER">Public / Auditor</option>
              </select>
            </div>

            {/* Re-score Sync Button */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer ${
                isSyncing 
                  ? 'bg-[#E7DDCA] text-[#504F47] cursor-not-allowed'
                  : 'bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Scoring...' : 'Re-score All'}</span>
            </button>
          </div>
        </div>

        {/* Popular Constituency Quick-Pills & Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-[#D8CBB6] py-2 gap-2">
          <div className="flex space-x-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'overview' ? 'bg-[#44312A] text-[#E7DDCA] shadow-xs' : 'text-[#504F47] hover:text-[#44312A]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('risk')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'risk' ? 'bg-[#44312A] text-[#E7DDCA] shadow-xs' : 'text-[#504F47] hover:text-[#44312A]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Risk Table</span>
            </button>
            <button
              onClick={() => setActiveTab('agency')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'agency' ? 'bg-[#44312A] text-[#E7DDCA] shadow-xs' : 'text-[#504F47] hover:text-[#44312A]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>eSAKSHI Benchmarks</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'map' ? 'bg-[#44312A] text-[#E7DDCA] shadow-xs' : 'text-[#504F47] hover:text-[#44312A]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Geo Map</span>
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'alerts' ? 'bg-[#44312A] text-[#E7DDCA] shadow-xs' : 'text-[#504F47] hover:text-[#44312A]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Alerts</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'audit' ? 'bg-[#44312A] text-[#E7DDCA] shadow-xs' : 'text-[#504F47] hover:text-[#44312A]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Audit Log</span>
            </button>
          </div>

          {/* Quick-fetch pills */}
          <div className="hidden lg:flex items-center space-x-1.5 text-[11px]">
            <span className="text-[#504F47] font-bold">Quick Live:</span>
            {popularConstituencies.map((c) => (
              <button
                key={c.val}
                onClick={() => handleQuickSelect(c.val)}
                className="px-2 py-0.5 rounded-lg bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] border border-[#D8CBB6] font-semibold transition cursor-pointer"
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
