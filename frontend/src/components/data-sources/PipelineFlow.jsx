import React from 'react';
import {
  Database,
  ArrowRight,
  ShieldCheck,
  Filter,
  Server,
  Code2,
  LayoutDashboard,
  CheckCircle2,
} from 'lucide-react';
import Card from '../ui/Card';

export default function PipelineFlow() {
  const steps = [
    {
      id: 1,
      title: '1. Source APIs',
      subtitle: 'MoSPI & Empowered Indian',
      detail: 'REST endpoints & JSON batch feeds',
      icon: Database,
      accent: 'border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A]',
    },
    {
      id: 2,
      title: '2. Ingestion Adapters',
      subtitle: 'Retries & Raw Archival',
      detail: 'Preserves timestamped data/raw copies',
      icon: Server,
      accent: 'border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A]',
    },
    {
      id: 3,
      title: '3. Normalization',
      subtitle: 'Schema Enforcement',
      detail: 'Null safe, datetime & numeric coercion',
      icon: Filter,
      accent: 'border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A]',
    },
    {
      id: 4,
      title: '4. PII Sanitization',
      subtitle: 'Privacy Protection',
      detail: 'Regex stripping of phone & email patterns',
      icon: ShieldCheck,
      accent: 'border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A]',
    },
    {
      id: 5,
      title: '5. Storage Engine',
      subtitle: 'PostgreSQL 16 / SQLite',
      detail: 'Idempotent upsert & indexed entities',
      icon: Database,
      accent: 'border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A]',
    },
    {
      id: 6,
      title: '6. FastAPI Service',
      subtitle: 'SQL Aggregations',
      detail: 'Real aggregates, pagination & filters',
      icon: Code2,
      accent: 'border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A]',
    },
    {
      id: 7,
      title: '7. JanDrishti UI',
      subtitle: 'Intelligence Dashboard',
      detail: 'Civic transparency & audit signals',
      icon: LayoutDashboard,
      accent: 'border-[#44312A] bg-[#44312A] text-[#E7DDCA] shadow-md',
    },
  ];

  return (
    <Card className="p-6 overflow-hidden">
      <div className="mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#44312A] flex items-center gap-2 font-display">
          <ShieldCheck className="h-4 w-4 text-[#44312A]" />
          <span>Verifiable Data Ingestion & Sanitization Pipeline</span>
        </h3>
        <p className="text-xs text-[#504F47] mt-1 leading-relaxed">
          How raw government and legislative data transitions from unauthenticated public feeds into normalized, privacy-sanitized intelligence records.
        </p>
      </div>

      {/* Horizontal Step Flow */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex flex-col items-center text-center relative group">
              {/* Card Container */}
              <div
                className={`w-full p-3.5 rounded-2xl border ${step.accent} flex flex-col items-center justify-between min-h-[140px] shadow-xs hover:scale-[1.02] transition-transform`}
              >
                <div className="h-8 w-8 rounded-xl flex items-center justify-center mb-1">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold">{step.title}</h4>
                  <div className="text-[10px] font-semibold mt-0.5 opacity-90">
                    {step.subtitle}
                  </div>
                </div>
                <p className="text-[9px] opacity-75 leading-tight mt-1">
                  {step.detail}
                </p>
              </div>

              {/* Arrow Connector (for desktop screens) */}
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-[#D8CBB6]">
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pipeline Guarantees */}
      <div className="mt-6 pt-5 border-t border-[#D8CBB6] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#44312A] block font-bold">Idempotent Ingestion</strong>
            <span className="text-[#504F47] text-[11px]">
              Re-running sync never creates duplicate works; existing rows are updated in place.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#44312A] block font-bold">Regex PII Protection</strong>
            <span className="text-[#504F47] text-[11px]">
              Incidental phone numbers and emails in work descriptions are permanently masked.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#44312A] block font-bold">Pure SQL Calculation</strong>
            <span className="text-[#504F47] text-[11px]">
              All summary indicators are derived directly from PostgreSQL aggregations.
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

