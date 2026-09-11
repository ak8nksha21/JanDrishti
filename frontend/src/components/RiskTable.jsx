import React, { useState, useMemo } from 'react';
import { Sparkles, Search, Eye, ChevronLeft, ChevronRight, AlertCircle, X } from 'lucide-react';

export default function RiskTable({ works = [], onSelectWork, onInvestigate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedConstituency, setSelectedConstituency] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const safeWorks = Array.isArray(works) ? works : [];
  
  const categories = useMemo(() => {
    return ['All', ...new Set(safeWorks.map(w => w.category).filter(Boolean))];
  }, [safeWorks]);

  const constituencies = useMemo(() => {
    const counts = {};
    safeWorks.forEach(w => {
      if (w.constituency) {
        counts[w.constituency] = (counts[w.constituency] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [safeWorks]);

  const filtered = useMemo(() => {
    const sTerm = searchTerm.toLowerCase().trim();
    return safeWorks.filter(w => {
      const matchesSearch = !sTerm ||
        (w.work_id || '').toLowerCase().includes(sTerm) ||
        (w.description || '').toLowerCase().includes(sTerm) ||
        (w.constituency || '').toLowerCase().includes(sTerm) ||
        (w.mp_name || '').toLowerCase().includes(sTerm) ||
        (w.location || '').toLowerCase().includes(sTerm);
        
      const matchesSeverity = selectedSeverity === 'All' || w.risk_level === selectedSeverity;
      const matchesCat = selectedCategory === 'All' || w.category === selectedCategory;
      const matchesConst = selectedConstituency === 'All' || w.constituency === selectedConstituency;

      return matchesSearch && matchesSeverity && matchesCat && matchesConst;
    });
  }, [safeWorks, searchTerm, selectedSeverity, selectedCategory, selectedConstituency]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedWorks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const handleFilterReset = () => {
    setSearchTerm('');
    setSelectedSeverity('All');
    setSelectedCategory('All');
    setSelectedConstituency('All');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || selectedSeverity !== 'All' || selectedCategory !== 'All' || selectedConstituency !== 'All';

  const getSeverityBadge = (level, score) => {
    switch (level) {
      case 'Critical':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF2F0] text-[#8A2616] border border-[#F2C0B6]">Critical ({score})</span>;
      case 'High':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF4EC] text-[#9C4E15] border border-[#F6D0B3]">High ({score})</span>;
      case 'Medium':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF8EE] text-[#7D5A1A] border border-[#EBD6A7]">Medium ({score})</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F3F8F2] text-[#3E5C38] border border-[#CFDFC8]">Low ({score})</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#EAE3D8] shadow-xs overflow-hidden">
      {/* Search & Filter Header */}
      <div className="p-4 border-b border-[#EAE3D8] bg-[#FCFAF7] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C7A70] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Work ID, description, MP, village, or block..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#FAF7F2] border border-[#E5DCD0] rounded-xl text-[#231815] placeholder-[#A89582] focus:outline-none focus:border-[#8B5A2B] transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-[#8C7A70] hover:text-[#231815]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Constituency Filter Dropdown */}
          <select
            value={selectedConstituency}
            onChange={(e) => {
              setSelectedConstituency(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#231815] focus:outline-none focus:border-[#8B5A2B] cursor-pointer"
          >
            <option value="All">All Constituencies ({safeWorks.length})</option>
            {constituencies.map(([c, count]) => (
              <option key={c} value={c}>
                {c} ({count})
              </option>
            ))}
          </select>

          {/* Sector Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#231815] focus:outline-none focus:border-[#8B5A2B] cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All Sectors' : c}
              </option>
            ))}
          </select>

          {/* Severity Badges */}
          <div className="flex items-center space-x-1 bg-[#FAF7F2] border border-[#E5DCD0] rounded-xl p-1 text-xs">
            {['All', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
              <button
                key={sev}
                onClick={() => {
                  setSelectedSeverity(sev);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedSeverity === sev
                    ? 'bg-[#3E2723] text-white shadow-xs'
                    : 'text-[#6E5A4E] hover:text-[#231815]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleFilterReset}
              className="px-2 py-1 text-xs text-[#8A2616] hover:text-[#66180C] font-bold hover:bg-[#FDF2F0] rounded-lg transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#FAF7F2] border-b border-[#EAE3D8] text-[#7A685D] uppercase font-bold text-[10px] tracking-wider">
              <th className="py-3 px-4">Work ID & Description</th>
              <th className="py-3 px-3">Sector</th>
              <th className="py-3 px-3">Sanctioned (₹ Lakhs)</th>
              <th className="py-3 px-3">Constituency / MP</th>
              <th className="py-3 px-3">Risk Band</th>
              <th className="py-3 px-3">Detection Flags</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAE3D8]">
            {paginatedWorks.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-[#8C7A70]">
                  <AlertCircle className="w-8 h-8 text-[#D9CEC1] mx-auto mb-2" />
                  <p className="font-bold text-[#231815]">No works match your filter criteria.</p>
                  <button
                    onClick={handleFilterReset}
                    className="mt-2 text-xs text-[#8B5A2B] hover:underline font-bold"
                  >
                    Clear active filters
                  </button>
                </td>
              </tr>
            ) : (
              paginatedWorks.map((w) => (
                <tr key={w.work_id} className="hover:bg-[#F5EFEB] transition-colors">
                  <td className="py-3 px-4 max-w-sm">
                    <div className="font-mono text-[11px] font-bold text-[#8B5A2B]">{w.work_id}</div>
                    <div className="font-bold text-[#231815] line-clamp-2 mt-0.5 leading-snug" title={w.description}>
                      {w.description}
                    </div>
                    <div className="text-[10px] text-[#7A685D] mt-0.5 truncate">{w.location}</div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-0.5 rounded-lg bg-[#FAF7F2] border border-[#E5DCD0] text-[#5C4A3E] text-[11px] font-medium">
                      {w.category}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-bold text-[#231815] whitespace-nowrap font-mono">
                    ₹{w.cost ? Number(w.cost).toFixed(1) : '0.0'}L
                  </td>

                  <td className="py-3 px-3">
                    <div className="font-bold text-[#231815]">{w.constituency}</div>
                    <div className="text-[11px] text-[#7A685D] truncate">{w.mp_name}</div>
                  </td>

                  <td className="py-3 px-3">
                    {getSeverityBadge(w.risk_level, w.overall_score)}
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {w.flags && w.flags.length > 0 ? (
                        w.flags.map((flag, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEF4EC] text-[#9C4E15] border border-[#F6D0B3]"
                          >
                            {flag}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-[#8C7A70]">Normal Baseline</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => onInvestigate(w.work_id)}
                        className="flex items-center space-x-1 px-2.5 py-1 bg-[#F5EFEB] hover:bg-[#EBE2D5] text-[#3E2723] rounded-xl font-bold border border-[#DFCFC0] transition text-xs shadow-xs cursor-pointer"
                        title="Run AI Investigation Agent"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#8B5A2B]" />
                        <span>Investigate</span>
                      </button>

                      <button
                        onClick={() => onSelectWork(w.work_id)}
                        className="p-1 hover:bg-[#F5EFEB] text-[#6E5A4E] rounded-lg transition cursor-pointer"
                        title="View Detailed Breakdown"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 bg-[#FCFAF7] border-t border-[#EAE3D8] text-xs text-[#7A685D] flex flex-col sm:flex-row justify-between items-center gap-2">
        <div>
          Showing <strong>{Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}</strong> to{' '}
          <strong>{Math.min(filtered.length, currentPage * pageSize)}</strong> of{' '}
          <strong>{filtered.length}</strong> works {hasActiveFilters && '(filtered)'}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-xl border border-[#E5DCD0] bg-white text-[#3E2723] hover:bg-[#F5EFEB] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-bold text-[#231815] bg-white border border-[#EAE3D8] rounded-xl">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-xl border border-[#E5DCD0] bg-white text-[#3E2723] hover:bg-[#F5EFEB] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
