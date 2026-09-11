import React from 'react';
import {
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Copy,
  FileCheck,
  Cpu,
  Bot,
  AlertCircle,
  ChevronRight,
  Database,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import Badge from '../ui/Badge';
import { Link } from '../../router/Router';
import { RISK_DISCLAIMER } from '../../utils/riskLanguage';

export default function InvestigationSignals({ stats = null }) {
  const currentFoundationItems = [
    {
      title: 'Statistical Cost Outlier Scan',
      status: 'Active',
      description: 'Heuristic flagging of works whose final completed cost significantly deviates from category median in the same state/district.',
      icon: TrendingUp,
      actionText: 'Inspect in Works Explorer',
      to: '/works',
    },
    {
      title: 'Data Completeness & Quality Audit',
      status: 'Active',
      description: 'Auditing missing geospatial coordinates, incomplete beneficiary counts, and implementing agency omissions in source feeds.',
      icon: FileCheck,
      actionText: 'Review Source Records',
      to: '/data-sources',
    },
    {
      title: 'Payment & Utilization Divergence',
      status: 'Active',
      description: 'Comparing allocated parliamentary limits against reported total completed expenditures to prioritize unspent balance follow-ups.',
      icon: Database,
      actionText: 'Inspect MP Ratios',
      to: '/mps',
    },
  ];

  const upcomingAIModules = [
    {
      title: 'Machine Learning Anomaly Detection',
      status: 'Coming Soon',
      tech: 'Isolation Forest & Multi-dimensional Mahalanobis distance',
      description: 'Unsupervised anomaly detection model trained on historical completed works to flag multidimensional irregularities across time, cost, and geography.',
      icon: Cpu,
    },
    {
      title: 'Semantic NLP Duplicate Work Detection',
      status: 'Coming Soon',
      tech: 'Sentence-Transformers & Cosine Similarity (<60m spatial buffer)',
      description: 'Identifies potential duplicate proposals where descriptions, sanctioned scopes, or locations closely overlap across financial years.',
      icon: Copy,
    },
    {
      title: 'Composite Risk Scoring (6-Factor Model)',
      status: 'Coming Soon',
      tech: 'Weighted ensemble: Cost + Frequency + Geo + Duplicate + Quality + Speed',
      description: 'Unified 0–100 risk scoring index designed to rank parliamentary works for prioritized administrative audit and field inspection.',
      icon: ShieldAlert,
    },
    {
      title: 'Autonomous Agentic AI Investigator',
      status: 'Coming Soon',
      tech: 'ReAct agent with deterministic database tools & citation verification',
      description: 'Generates explainable, verifiable investigation dossiers on flagged works using verifiable SQL queries without hallucination.',
      icon: Bot,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-[#44312A] tracking-tight font-display">
              Investigation Signals & Analytics Architecture
            </h2>
            <Badge variant="primary" size="sm">
              INTELLIGENCE LAYER
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Distinguishing currently validated empirical indicators from upcoming ML audit modules.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Available Now (Data Foundation) */}
        <Card>
          <CardHeader className="bg-[#FAF7F2] border-[#D8CBB6]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#44312A]" />
                <CardTitle className="text-[#44312A]">
                  Operational Intelligence Foundation
                </CardTitle>
              </div>
              <Badge variant="primary" size="sm">
                AVAILABLE NOW
              </Badge>
            </div>
            <CardDescription className="text-[#504F47]">
              Validated data layer driven by real-time SQL queries against official MoSPI and Empowered Indian records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {currentFoundationItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] hover:border-[#44312A] transition space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#44312A]">
                      <Icon className="h-4 w-4 text-[#44312A] shrink-0" />
                      <span>{item.title}</span>
                    </div>
                    <Link
                      to={item.to}
                      className="text-[11px] text-[#44312A] hover:underline inline-flex items-center gap-0.5 font-bold"
                    >
                      {item.actionText} <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <p className="text-xs text-[#504F47] leading-relaxed pl-6">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Right: Coming Soon (Upcoming AI Modules) */}
        <Card>
          <CardHeader className="bg-[#FAF7F2] border-[#D8CBB6]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#44312A]" />
                <CardTitle className="text-[#44312A]">
                  Next Intelligence Layer (AI & Risk Models)
                </CardTitle>
              </div>
              <Badge variant="default" size="sm">
                COMING SOON
              </Badge>
            </div>
            <CardDescription className="text-[#504F47]">
              Advanced machine learning & automated audit modules currently in development and sandbox validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {upcomingAIModules.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="h-7 w-7 rounded-xl bg-[#E7DDCA] border border-[#D8CBB6] flex items-center justify-center text-[#44312A] shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#44312A]">
                          {item.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#504F47] font-mono mt-0.5 font-semibold">
                        {item.tech}
                      </div>
                      <p className="text-[11px] text-[#504F47] mt-1 leading-snug">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[#E7DDCA] text-[#44312A] font-bold border border-[#D8CBB6]">
                    Roadmap
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Subtle Civic Disclaimer Banner */}
      <div className="p-3.5 rounded-2xl bg-[#F4EFE6] border border-[#D8CBB6] text-[#44312A] flex items-center gap-2.5 text-xs">
        <AlertCircle className="h-4 w-4 text-[#44312A] shrink-0" />
        <p className="leading-relaxed">
          <strong className="text-[#44312A]">Institutional Governance Notice: </strong>
          {RISK_DISCLAIMER} All current signals represent statistical deviations and verified public records.
        </p>
      </div>
    </div>
  );
}
