/**
 * MP Financial & Execution Risk Score Engine
 *
 * Provides analytical monitoring scores (0–100) and multi-factor execution
 * breakdowns computed strictly from existing MP financial summary records.
 *
 * Principles:
 * - Strictly uses verified data fields from MPFinancialSummary.
 * - Missing values are NEVER silently coerced to zero.
 * - Unavailable metrics are omitted and available component weights are dynamically renormalized.
 * - If insufficient data exists, returns score: null, level: "Insufficient Data".
 * - Score bands: 0–30 Low, 31–60 Medium, 61–80 High, 81–100 Critical.
 * - Output includes explicit civic disclaimer.
 */

import { formatCroresLakhs } from './formatting.js';

export const MP_RISK_DISCLAIMER =
  'Indicative MP portfolio risk: Analytical product indicator based on available financial and execution metrics. Thresholds are JanDrishti analytical choices and are not official MPLADS thresholds.';

/**
 * Returns risk level category string based on score.
 * @param {number|null} score
 * @returns {'Low' | 'Medium' | 'High' | 'Critical' | 'Insufficient Data'}
 */
export function getMPRiskBand(score) {
  if (score === null || score === undefined || isNaN(score)) {
    return 'Insufficient Data';
  }
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Medium';
  if (score <= 80) return 'High';
  return 'Critical';
}

/**
 * Maps MP risk level to UI styling tokens (Brown & Cream palette).
 * @param {string} level
 */
export function getMPRiskBadgeConfig(level) {
  const norm = String(level || '').toLowerCase();
  if (norm === 'critical') {
    return {
      label: 'Critical Risk',
      bgClass: 'bg-[#44312A] text-[#E7DDCA] border-[#34241E]',
      badgeVariant: 'primary',
      dotColor: 'bg-[#E7DDCA]',
    };
  }
  if (norm === 'high') {
    return {
      label: 'High Risk',
      bgClass: 'bg-[#504F47] text-white border-[#3F3E37]',
      badgeVariant: 'warning',
      dotColor: 'bg-[#E7DDCA]',
    };
  }
  if (norm === 'medium') {
    return {
      label: 'Medium Risk',
      bgClass: 'bg-[#FAF7F2] text-[#44312A] border-[#D8CBB6]',
      badgeVariant: 'outline',
      dotColor: 'bg-[#6B5145]',
    };
  }
  if (norm === 'low') {
    return {
      label: 'Low Risk',
      bgClass: 'bg-white text-[#504F47] border-[#D8CBB6]',
      badgeVariant: 'outline',
      dotColor: 'bg-[#8C7769]',
    };
  }
  return {
    label: 'Insufficient Data',
    bgClass: 'bg-[#FAF7F2] text-[#8C7769] border-[#D8CBB6]',
    badgeVariant: 'outline',
    dotColor: 'bg-[#8C7769]',
  };
}

/**
 * Calculates deterministic generalized MP Financial & Execution Risk Score (0–100)
 * and detailed factor breakdown from an MP financial summary object.
 *
 * @param {Object} mp MP financial summary record
 * @returns {Object} Calculated risk object
 */
export function calculateMPRisk(mp) {
  if (!mp || typeof mp !== 'object') {
    return {
      score: null,
      level: 'Insufficient Data',
      breakdown: [],
      topSignals: [],
      hasSufficientData: false,
      disclaimer: MP_RISK_DISCLAIMER,
    };
  }

  const breakdown = [];
  let availableWeight = 0;
  let weightedScoreSum = 0;

  // Helper to safely parse numbers
  const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  };

  const allocated = parseNum(mp.allocated_amount);
  const expenditure = parseNum(mp.total_expenditure);
  const expPercentage = parseNum(mp.expenditure_percentage);
  const unspent = parseNum(mp.unspent_amount);
  const paymentGap = parseNum(mp.payment_gap_percentage);
  const recommendedWorks = parseNum(mp.recommended_works_count);
  const completedWorks = parseNum(mp.completed_works_count);
  const pendingWorks = parseNum(mp.pending_works);
  const completionRate = parseNum(mp.completion_rate);

  // -------------------------------------------------------------
  // 1. Financial & Expenditure Utilization Risk (Weight: 20)
  // -------------------------------------------------------------
  let effectiveUtil = expPercentage;
  if (effectiveUtil === null && expenditure !== null && allocated !== null && allocated > 0) {
    effectiveUtil = (expenditure / allocated) * 100;
  }

  if (effectiveUtil !== null) {
    let score = 20;
    let explanation = `Expenditure utilization at ${effectiveUtil.toFixed(1)}% reflects standard fund deployment.`;
    let signal = null;

    if (effectiveUtil > 105) {
      score = Math.min(95, Math.round(60 + (effectiveUtil - 100) * 1.5));
      explanation = `Expenditure (${effectiveUtil.toFixed(1)}%) exceeds total allocated entitlement limit.`;
      signal = 'Expenditure exceeds allocation limit';
    } else if (effectiveUtil < 25) {
      score = Math.min(95, Math.round(85 - effectiveUtil * 1.2));
      explanation = `Critically low expenditure utilization at ${effectiveUtil.toFixed(1)}%.`;
      signal = 'Critically low expenditure utilization';
    } else if (effectiveUtil < 50) {
      score = Math.round(65 - (effectiveUtil - 25) * 0.8);
      explanation = `Subdued expenditure utilization at ${effectiveUtil.toFixed(1)}%.`;
      signal = 'Subdued fund utilization rate';
    } else if (effectiveUtil < 70) {
      score = Math.round(45 - (effectiveUtil - 50) * 0.7);
      explanation = `Moderate expenditure utilization at ${effectiveUtil.toFixed(1)}%.`;
    } else {
      score = Math.max(10, Math.round(25 - (effectiveUtil - 70) * 0.5));
      explanation = `Healthy expenditure utilization at ${effectiveUtil.toFixed(1)}%.`;
    }

    const weight = 20;
    availableWeight += weight;
    weightedScoreSum += score * weight;

    breakdown.push({
      key: 'utilization',
      title: 'Financial & Expenditure Utilization Risk',
      score,
      valueDisplay: `${effectiveUtil.toFixed(1)}%`,
      explanation,
      sourceMetric: 'total_expenditure / allocated_amount (Expenditure Utilization)',
      signal: score >= 55 ? signal : null,
      weight,
    });
  }

  // -------------------------------------------------------------
  // 2. Unspent Balance Risk (Weight: 20)
  // -------------------------------------------------------------
  if (unspent !== null && allocated !== null && allocated > 0) {
    const unspentRatio = unspent / allocated;
    const unspentPct = unspentRatio * 100;
    let score = 20;
    let explanation = `Unspent balance of ₹${(unspent / 10000000).toFixed(2)} Cr represents ${unspentPct.toFixed(1)}% of allocation.`;
    let signal = null;

    if (unspentRatio >= 0.80) {
      score = Math.min(95, Math.round(75 + (unspentRatio - 0.80) * 100));
      explanation = `High unspent balance representing ${unspentPct.toFixed(1)}% of total allocated entitlement.`;
      signal = 'High unspent balance';
    } else if (unspentRatio >= 0.50) {
      score = Math.round(55 + (unspentRatio - 0.50) * 60);
      explanation = `Moderate unspent balance of ${unspentPct.toFixed(1)}% remains committed or unspent.`;
      signal = 'Elevated unspent parliamentary balance';
    } else if (unspentRatio >= 0.25) {
      score = Math.round(35 + (unspentRatio - 0.25) * 60);
      explanation = `Standard unspent balance at ${unspentPct.toFixed(1)}% of allocation.`;
    } else {
      score = Math.max(10, Math.round(15 + unspentRatio * 60));
      explanation = `Low unspent balance (${unspentPct.toFixed(1)}%), indicating timely fund deployment.`;
    }

    const weight = 20;
    availableWeight += weight;
    weightedScoreSum += score * weight;

    breakdown.push({
      key: 'unspent',
      title: 'Unspent Balance Risk',
      score,
      valueDisplay: formatCroresLakhs(unspent).compact,
      explanation,
      sourceMetric: 'unspent_amount / allocated_amount',
      signal: score >= 55 ? signal : null,
      weight,
    });
  }

  // -------------------------------------------------------------
  // 3. Payment / Execution Gap Risk (Weight: 20)
  // -------------------------------------------------------------
  if (paymentGap !== null) {
    let score = 20;
    let explanation = `Payment gap at ${paymentGap.toFixed(1)}% within expected operational tolerance.`;
    let signal = null;

    if (paymentGap >= 60) {
      score = Math.min(95, Math.round(75 + (paymentGap - 60) * 0.8));
      explanation = `Elevated payment gap (${paymentGap.toFixed(1)}%) indicates heavy in-progress liabilities.`;
      signal = 'Significant payment/execution gap';
    } else if (paymentGap >= 45) {
      score = Math.round(55 + (paymentGap - 45) * 1.3);
      explanation = `Moderate payment gap (${paymentGap.toFixed(1)}%) between disbursements and completed works.`;
      signal = 'Moderate payment/execution divergence';
    } else if (paymentGap >= 25) {
      score = Math.round(35 + (paymentGap - 25) * 1.0);
      explanation = `Standard payment-to-completion progress gap (${paymentGap.toFixed(1)}%).`;
    } else {
      score = Math.max(10, Math.round(15 + paymentGap * 0.8));
      explanation = `Low payment gap (${paymentGap.toFixed(1)}%), reflecting timely account closures.`;
    }

    const weight = 20;
    availableWeight += weight;
    weightedScoreSum += score * weight;

    breakdown.push({
      key: 'payment_gap',
      title: 'Payment / Execution Gap Risk',
      score,
      valueDisplay: `${paymentGap.toFixed(1)}%`,
      explanation,
      sourceMetric: 'payment_gap_percentage / in_progress_payments',
      signal: score >= 55 ? signal : null,
      weight,
    });
  }

  // -------------------------------------------------------------
  // 4. Pending Works Risk (Weight: 20)
  // -------------------------------------------------------------
  let effectivePending = pendingWorks;
  if (effectivePending === null && recommendedWorks !== null && completedWorks !== null) {
    effectivePending = Math.max(0, recommendedWorks - completedWorks);
  }

  if (recommendedWorks !== null && recommendedWorks > 0 && effectivePending !== null) {
    const pendingRatio = effectivePending / recommendedWorks;
    const pendingPct = pendingRatio * 100;
    let score = 20;
    let explanation = `${effectivePending} of ${recommendedWorks} works (${pendingPct.toFixed(1)}%) pending completion.`;
    let signal = null;

    if (pendingRatio >= 0.85) {
      score = Math.min(95, Math.round(80 + (pendingRatio - 0.85) * 100));
      explanation = `Very high pending-work proportion (${pendingPct.toFixed(1)}% of sanctioned works remain pending).`;
      signal = 'Very high pending-work proportion';
    } else if (pendingRatio >= 0.60) {
      score = Math.round(55 + (pendingRatio - 0.60) * 80);
      explanation = `Substantial pending-work volume (${pendingPct.toFixed(1)}% uncompleted).`;
      signal = 'High volume of pending infrastructure works';
    } else if (pendingRatio >= 0.35) {
      score = Math.round(35 + (pendingRatio - 0.35) * 80);
      explanation = `Moderate pending work volume (${pendingPct.toFixed(1)}% in progress).`;
    } else {
      score = Math.max(10, Math.round(15 + pendingRatio * 50));
      explanation = `Low pending proportion (${pendingPct.toFixed(1)}%), demonstrating active project execution.`;
    }

    const weight = 20;
    availableWeight += weight;
    weightedScoreSum += score * weight;

    breakdown.push({
      key: 'pending_works',
      title: 'Pending Works Risk',
      score,
      valueDisplay: `${effectivePending} / ${recommendedWorks}`,
      explanation,
      sourceMetric: 'pending_works / recommended_works_count',
      signal: score >= 55 ? signal : null,
      weight,
    });
  }

  // -------------------------------------------------------------
  // 5. Physical Completion Risk (Weight: 20)
  // -------------------------------------------------------------
  let effectiveCompRate = completionRate;
  if (effectiveCompRate === null && recommendedWorks !== null && recommendedWorks > 0 && completedWorks !== null) {
    effectiveCompRate = (completedWorks / recommendedWorks) * 100;
  }

  if (effectiveCompRate !== null) {
    let score = 20;
    let explanation = `Physical completion rate at ${effectiveCompRate.toFixed(1)}%.`;
    let signal = null;

    if (effectiveCompRate < 15) {
      score = Math.min(95, Math.round(85 - effectiveCompRate * 1.5));
      explanation = `Low physical completion rate at ${effectiveCompRate.toFixed(1)}% of recommended works.`;
      signal = 'Low physical completion rate';
    } else if (effectiveCompRate < 40) {
      score = Math.round(60 - (effectiveCompRate - 15) * 0.8);
      explanation = `Subdued physical completion rate at ${effectiveCompRate.toFixed(1)}%.`;
      signal = 'Subdued project completion rate';
    } else if (effectiveCompRate < 70) {
      score = Math.round(40 - (effectiveCompRate - 40) * 0.6);
      explanation = `Moderate physical completion rate at ${effectiveCompRate.toFixed(1)}%.`;
    } else {
      score = Math.max(10, Math.round(20 - (effectiveCompRate - 70) * 0.3));
      explanation = `High physical completion rate at ${effectiveCompRate.toFixed(1)}%.`;
    }

    const weight = 20;
    availableWeight += weight;
    weightedScoreSum += score * weight;

    breakdown.push({
      key: 'completion_rate',
      title: 'Physical Completion Risk',
      score,
      valueDisplay: `${effectiveCompRate.toFixed(1)}%`,
      explanation,
      sourceMetric: 'completed_works_count / recommended_works_count (completion_rate)',
      signal: score >= 55 ? signal : null,
      weight,
    });
  }

  // -------------------------------------------------------------
  // Score Normalization & Missing Data Handling
  // -------------------------------------------------------------
  if (availableWeight === 0 || breakdown.length === 0) {
    return {
      score: null,
      level: 'Insufficient Data',
      breakdown: [],
      topSignals: [],
      hasSufficientData: false,
      disclaimer: MP_RISK_DISCLAIMER,
    };
  }

  // Renormalize available components
  const finalScore = Math.min(100, Math.max(0, Math.round(weightedScoreSum / availableWeight)));
  const level = getMPRiskBand(finalScore);

  // Extract top contributing signals (supported by real data)
  const topSignals = breakdown
    .filter((b) => b.signal)
    .sort((a, b) => b.score - a.score)
    .map((b) => b.signal);

  if (topSignals.length === 0 && finalScore <= 30) {
    topSignals.push('Standard expenditure deployment and consistent project execution');
  }

  return {
    score: finalScore,
    level,
    breakdown,
    topSignals,
    hasSufficientData: true,
    disclaimer: MP_RISK_DISCLAIMER,
  };
}
