/**
 * Risk language conventions & disclaimers.
 * Adheres strictly to civic and administrative intelligence standards.
 * Prohibits accusatory claims and uses "Flagged Risk", "Anomalous Cost", or "Needs Review".
 * Styled with the strict Cream #E7DDCA & Dark Brown #44312A palette.
 */

export const RISK_DISCLAIMER =
  'Risk indicators are quantitative signals intended for investigation support and administrative review. They do not constitute a legal finding of wrongdoing.';

export const RISK_LABELS = {
  LOW: 'Standard Record',
  MEDIUM: 'Needs Review',
  HIGH: 'Flagged Risk',
  CRITICAL: 'Anomalous Cost / Priority Review',
  DUPLICATE_POTENTIAL: 'Potential Duplicate Match',
  COST_OUTLIER: 'Cost Deviation Signal',
  QUALITY_CONCERN: 'Data Quality Concern',
};

/**
 * Maps raw risk levels to compliant, non-accusatory civic terms
 * @param {string|null|undefined} level
 * @returns {{ label: string, colorClass: string, badgeBg: string, dotColor: string }}
 */
export function getRiskBadgeConfig(level) {
  const norm = String(level || '').toLowerCase();

  if (norm === 'critical') {
    return {
      label: 'Priority Review Signal',
      colorClass: 'text-white border-[#44312A] bg-[#44312A] font-bold shadow-xs',
      badgeBg: 'bg-[#44312A]',
      dotColor: 'bg-white',
    };
  }
  if (norm === 'high') {
    return {
      label: 'Flagged Risk',
      colorClass: 'text-white border-[#504F47] bg-[#504F47] font-semibold',
      badgeBg: 'bg-[#504F47]',
      dotColor: 'bg-[#E7DDCA]',
    };
  }
  if (norm === 'medium') {
    return {
      label: 'Needs Review',
      colorClass: 'text-[#44312A] border-[#CFC0A7] bg-[#F4EFE6] font-medium',
      badgeBg: 'bg-[#6B5145]',
      dotColor: 'bg-[#6B5145]',
    };
  }
  return {
    label: 'Standard Record',
    colorClass: 'text-[#504F47] border-[#D8CBB6] bg-white',
    badgeBg: 'bg-[#8C7769]',
    dotColor: 'bg-[#8C7769]',
  };
}
