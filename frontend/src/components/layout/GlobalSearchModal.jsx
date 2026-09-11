import React, { useState, useEffect, useRef } from 'react';
import { Search, Briefcase, Users, ArrowRight, X, Loader2 } from 'lucide-react';
import { useRouter } from '../../router/Router';
import { fetchWorks } from '../../services/works';
import { fetchMPs } from '../../services/mps';
import { formatCroresLakhs } from '../../utils/formatting';

export default function GlobalSearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ works: [], mps: [] });
  const inputRef = useRef(null);
  const { navigate } = useRouter();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ works: [], mps: [] });
    }
  }, [isOpen]);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search against real backend
  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      setResults({ works: [], mps: [] });
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [worksRes, mpsRes] = await Promise.allSettled([
          fetchWorks({ constituency: clean, limit: 5 }),
          fetchMPs({ constituency: clean, limit: 5 }),
        ]);

        const worksList = worksRes.status === 'fulfilled' ? worksRes.value.items || [] : [];
        const mpsList = mpsRes.status === 'fulfilled' ? mpsRes.value.items || [] : [];

        setResults({ works: worksList, mps: mpsList });
      } catch (err) {
        console.warn('Global search query error:', err);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelectWork = (workId) => {
    onClose();
    navigate(`/works/${workId}`);
  };

  const handleSelectMP = (mpId) => {
    onClose();
    navigate(`/mps/${mpId}`);
  };

  const handleSearchAllWorks = () => {
    onClose();
    navigate(`/works?constituency=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#44312A]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white border border-[#D8CBB6] rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#D8CBB6] flex items-center gap-3 bg-[#FAF7F2]">
          <Search className="h-5 w-5 text-[#44312A] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by constituency, MP name, or work ID..."
            className="w-full bg-transparent text-sm text-[#44312A] placeholder-[#8C7769] focus:outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 text-[#44312A] animate-spin shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="text-[#504F47] hover:text-[#44312A] p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono bg-[#E7DDCA] text-[#44312A] rounded border border-[#D8CBB6]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {query.trim().length < 2 && (
            <div className="py-8 text-center text-[#504F47] text-xs">
              Type at least 2 characters to search across live works, MPs, and constituencies.
            </div>
          )}

          {query.trim().length >= 2 && !loading && results.works.length === 0 && results.mps.length === 0 && (
            <div className="py-8 text-center text-[#504F47] text-xs">
              No matching records found for "{query}". Try searching a constituency like "SHAHJAHANPUR" or "Gorakhpur".
            </div>
          )}

          {/* MPs Section */}
          {results.mps.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#504F47] px-2 mb-2 flex items-center gap-1.5">
                <Users className="h-3 w-3 text-[#44312A]" />
                <span>Members of Parliament ({results.mps.length})</span>
              </div>
              <div className="space-y-1">
                {results.mps.map((mp) => (
                  <div
                    key={mp.id}
                    onClick={() => handleSelectMP(mp.id)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E7DDCA]/50 cursor-pointer group transition border border-transparent hover:border-[#D8CBB6]"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#44312A] group-hover:text-[#44312A] transition-colors">
                        {mp.mp_name}
                      </div>
                      <div className="text-[11px] text-[#504F47] flex items-center gap-2 mt-0.5">
                        <span className="text-[#44312A] font-medium">{mp.constituency || 'Constituency'}</span>
                        <span>•</span>
                        <span>{mp.state || 'State'}</span>
                        <span>•</span>
                        <span className="font-mono text-[#44312A] font-semibold">
                          {formatCroresLakhs(mp.total_expenditure).compact} spent
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#8C7769] group-hover:text-[#44312A] transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Works Section */}
          {results.works.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#504F47] px-2 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3 text-[#44312A]" />
                  <span>Itemized Completed Works ({results.works.length})</span>
                </div>
                <button
                  onClick={handleSearchAllWorks}
                  className="text-[10px] text-[#44312A] font-semibold hover:underline inline-flex items-center gap-1"
                >
                  View all results <ArrowRight className="h-2.5 w-2.5" />
                </button>
              </div>
              <div className="space-y-1">
                {results.works.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => handleSelectWork(w.work_id || w.id)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E7DDCA]/50 cursor-pointer group transition border border-transparent hover:border-[#D8CBB6]"
                  >
                    <div className="max-w-[85%]">
                      <div className="text-xs font-bold text-[#44312A] group-hover:text-[#44312A] transition-colors truncate">
                        {w.work_description || 'Completed MPLADS Work'}
                      </div>
                      <div className="text-[11px] text-[#504F47] flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[#44312A] font-medium">ID: {w.work_id || w.id}</span>
                        <span>•</span>
                        <span>{w.constituency || 'Constituency'}</span>
                        <span>•</span>
                        <span className="text-[#44312A] font-mono font-medium">
                          {formatCroresLakhs(w.cost).compact}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#8C7769] group-hover:text-[#44312A] transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#D8CBB6] bg-[#FAF7F2] flex items-center justify-between text-[11px] text-[#504F47]">
          <span>Real-time lookup via JanDrishti SQL indexes</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
