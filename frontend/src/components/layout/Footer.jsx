import React from 'react';
import { Shield, Database, ExternalLink, Code, Info } from 'lucide-react';
import { Link } from '../../router/Router';
import { RISK_DISCLAIMER } from '../../utils/riskLanguage';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[#D8CBB6] bg-white text-[#504F47] py-12 px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Purpose */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-[#44312A] flex items-center justify-center text-white font-bold shadow-xs">
                <Shield className="h-4 w-4 stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-[#44312A] tracking-wider text-base font-display">
                JAN<span className="text-[#504F47]">DRISHTI</span>
              </span>
              <span className="text-[10px] text-[#504F47] uppercase tracking-wider font-mono">
                MPLADS Intelligence Platform
              </span>
            </div>
            <p className="text-xs text-[#504F47] leading-relaxed max-w-lg">
              Data-driven monitoring for transparency, accountability and better public expenditure oversight.
              Aggregating and validating official data from MoSPI e-SAKSHI and public legislative records.
            </p>
            <div className="pt-1">
              <p className="text-[11px] text-[#6B5145] font-medium">
                Independent Civic Technology Project — Smart India Hackathon Architecture
              </p>
            </div>
          </div>

          {/* Navigation links */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#44312A]">
              Platform Sections
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link to="/" className="hover:text-[#44312A] transition-colors">
                  Overview Dashboard
                </Link>
              </li>
              <li>
                <Link to="/works" className="hover:text-[#44312A] transition-colors">
                  Works Explorer
                </Link>
              </li>
              <li>
                <Link to="/mps" className="hover:text-[#44312A] transition-colors">
                  MP Performance Intelligence
                </Link>
              </li>
              <li>
                <Link to="/analytics" className="hover:text-[#44312A] transition-colors">
                  Analytics & Visualizations
                </Link>
              </li>
            </ul>
          </div>

          {/* Reference & Source Attribution */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#44312A]">
              Official Data Sources
            </h4>
            <p className="text-xs text-[#504F47] leading-relaxed">
              Data sources: MoSPI/e-SAKSHI and publicly available legislative records.
            </p>
            <ul className="space-y-2 text-xs pt-1">
              <li>
                <a
                  href="https://mplads.mospi.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#504F47] hover:text-[#44312A] transition-colors"
                >
                  <Database className="h-3.5 w-3.5 text-[#44312A]" />
                  <span>MoSPI e-SAKSHI Portal</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/ak8nksha21/JanDrishti"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#504F47] hover:text-[#44312A] transition-colors"
                >
                  <Code className="h-3.5 w-3.5 text-[#504F47]" />
                  <span>GitHub Repository</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Institutional Statutory Disclaimer */}
        <div className="pt-6 border-t border-[#D8CBB6] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] text-[#504F47]">
          <div className="flex items-start gap-2 max-w-3xl">
            <Info className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
            <p>
              <span className="font-semibold text-[#44312A]">Notice: </span>
              {RISK_DISCLAIMER} JanDrishti is an independent analytics tool and does not represent an official endorsement by any Ministry.
            </p>
          </div>
          <div className="text-[#504F47] font-mono text-[10px] shrink-0">
            JanDrishti Core v0.2.0 • 2026
          </div>
        </div>
      </div>
    </footer>
  );
}
