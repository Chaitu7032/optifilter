import React from 'react';
import { CheckCircle2, AlertTriangle, Eye, Activity, Info, ShieldAlert } from 'lucide-react';

interface GlaucomaAssessmentProps {
  vcdr: number | null;
  outcomeStatus?: string;
  isFallback?: boolean;
  warnings?: string[];
  assessment?: {
    status: string;
    risk_level: 'nominal' | 'borderline' | 'elevated' | 'unknown' | string;
    description: string;
    threshold_used: string;
    disclaimer?: string;
  };
}

export const GlaucomaAssessmentCard: React.FC<GlaucomaAssessmentProps> = ({
  vcdr,
  outcomeStatus,
  isFallback,
  warnings,
  assessment,
}) => {
  if (vcdr === null || vcdr === undefined) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-xs space-y-2 shadow-xs">
        <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
          <Eye className="w-4 h-4 text-[#059669]" />
          <span>Experimental Glaucoma-Related Structural Indicator</span>
        </div>
        <p className="text-xs text-[#64748B] leading-relaxed">
          Vertical CDR unavailable. Segmentation failed or did not identify a plausible optic disc and cup boundary.
        </p>
      </div>
    );
  }

  const isWarning = outcomeStatus === 'WARNING' || outcomeStatus === 'FALLBACK' || isFallback || (warnings && warnings.length > 0);
  const riskLevel = assessment?.risk_level ?? (vcdr >= 0.65 ? 'elevated' : vcdr >= 0.50 ? 'borderline' : 'nominal');

  const badgeConfig = {
    nominal: {
      bg: 'bg-emerald-50/60',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      badgeBg: 'bg-emerald-600',
      badgeText: 'text-white',
      label: 'Nominal Exploratory Range (< 0.50)',
      icon: CheckCircle2,
    },
    borderline: {
      bg: 'bg-amber-50/60',
      border: 'border-amber-200',
      text: 'text-amber-900',
      badgeBg: 'bg-amber-600',
      badgeText: 'text-white',
      label: 'Borderline Interval (0.50 - 0.65)',
      icon: AlertTriangle,
    },
    elevated: {
      bg: 'bg-rose-50/60',
      border: 'border-rose-200',
      text: 'text-rose-900',
      badgeBg: 'bg-rose-600',
      badgeText: 'text-white',
      label: 'Elevated Structural Ratio (≥ 0.65)',
      icon: ShieldAlert,
    },
    unknown: {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-800',
      badgeBg: 'bg-slate-600',
      badgeText: 'text-white',
      label: 'Indeterminate / Fallback Prior',
      icon: Info,
    },
  }[riskLevel] || {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-800',
    badgeBg: 'bg-slate-600',
    badgeText: 'text-white',
    label: 'Calculated Structural Indicator',
    icon: Info,
  };

  const IconComponent = badgeConfig.icon;

  return (
    <div className={`rounded-xl border p-4 text-xs space-y-3 shadow-xs ${badgeConfig.bg} ${badgeConfig.border}`}>
      <div className="flex items-center justify-between pb-2 border-b border-black/5 gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
          <Eye className="w-4 h-4 text-[#059669]" />
          <span>Experimental Glaucoma-Related Indicator</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${badgeConfig.badgeBg} ${badgeConfig.badgeText}`}
        >
          <IconComponent className="w-3 h-3" />
          {badgeConfig.label}
        </span>
      </div>

      {/* Fallback or Plausibility Notice */}
      {isWarning && (
        <div className="bg-amber-100/80 border border-amber-300 rounded-lg p-2.5 text-[11px] text-amber-950 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700" />
          <div>
            <span className="font-semibold text-amber-950">Boundary Advisory: </span>
            {isFallback
              ? 'A circular fallback prior was applied during contour fitting. Measurement should be interpreted cautiously.'
              : 'Active contour reported boundary or contrast uncertainty for this optic disc/cup.'}
          </div>
        </div>
      )}

      {/* Prominent Quantitative Metric */}
      <div className="flex items-baseline justify-between bg-white p-2.5 rounded-lg border border-[#E2E8F0] shadow-2xs">
        <span className="text-[#64748B] font-mono">Vertical Cup-to-Disc Ratio (vCDR):</span>
        <span className="font-mono font-bold text-base text-[#0F172A]">
          {vcdr.toFixed(4)}
        </span>
      </div>

      <p className={`text-[11px] leading-relaxed font-sans ${badgeConfig.text}`}>
        {assessment?.description ?? `Experimental vertical cup-to-disc ratio calculated from segmented disc and cup contours: ${vcdr.toFixed(4)}.`}
      </p>

      {/* Mandatory Non-Diagnostic Clinical Disclaimer */}
      <div className="bg-white/95 border border-[#E2E8F0] rounded-lg p-2.5 text-[10px] text-[#475569] leading-relaxed shadow-2xs">
        <span className="font-semibold text-[#0F172A]">Research Disclaimer: </span>
        Experimental vCDR estimate derived solely from digital image processing algorithms. This measurement is not a clinical glaucoma diagnosis. Professional ophthalmic examination is required for clinical diagnosis.
      </div>

      {/* Exploratory Population Reference Intervals */}
      <div className="pt-2 border-t border-black/5 text-[10px] font-mono text-[#64748B] space-y-1">
        <div className="font-sans font-semibold text-[#0F172A] text-[10px] uppercase tracking-wider">
          Exploratory Reference Intervals (Non-Diagnostic):
        </div>
        <div className="flex justify-between">
          <span>vCDR &lt; 0.50:</span>
          <span className="text-emerald-700 font-semibold">Nominal physiological range</span>
        </div>
        <div className="flex justify-between">
          <span>0.50 &le; vCDR &lt; 0.65:</span>
          <span className="text-amber-700 font-semibold">Intermediate exploratory interval</span>
        </div>
        <div className="flex justify-between">
          <span>vCDR &ge; 0.65:</span>
          <span className="text-rose-700 font-semibold">Elevated exploratory threshold</span>
        </div>
      </div>
    </div>
  );
};

interface DiabeticRetinopathyAssessmentProps {
  vesselDensity: number;
  assessment?: {
    status: string;
    risk_level: 'nominal' | 'low_density' | 'high_density' | string;
    vessel_density_pct: number;
    description: string;
    threshold_used: string;
    disclaimer?: string;
  };
}

export const DiabeticRetinopathyCard: React.FC<DiabeticRetinopathyAssessmentProps> = ({
  vesselDensity,
  assessment,
}) => {
  const densityPct = assessment?.vessel_density_pct ?? Number((vesselDensity * 100).toFixed(2));
  const isNominal = vesselDensity >= 0.08 && vesselDensity <= 0.16;
  const isLow = vesselDensity < 0.08;

  const badgeConfig = isNominal
    ? {
        bg: 'bg-emerald-50/60',
        border: 'border-emerald-200',
        text: 'text-emerald-900',
        badgeBg: 'bg-emerald-600',
        badgeText: 'text-white',
        label: 'Nominal Fundus Range (8-16%)',
        icon: CheckCircle2,
      }
    : isLow
    ? {
        bg: 'bg-amber-50/60',
        border: 'border-amber-200',
        text: 'text-amber-900',
        badgeBg: 'bg-amber-600',
        badgeText: 'text-white',
        label: 'Sub-Nominal Density (< 8%)',
        icon: AlertTriangle,
      }
    : {
        bg: 'bg-amber-50/60',
        border: 'border-amber-200',
        text: 'text-amber-900',
        badgeBg: 'bg-amber-600',
        badgeText: 'text-white',
        label: 'Elevated Density (> 16%)',
        icon: AlertTriangle,
      };

  const IconComponent = badgeConfig.icon;

  return (
    <div className={`rounded-xl border p-4 text-xs space-y-3 shadow-xs ${badgeConfig.bg} ${badgeConfig.border}`}>
      <div className="flex items-center justify-between pb-2 border-b border-black/5 gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
          <Activity className="w-4 h-4 text-[#059669]" />
          <span>Mask-Derived Retinal Vessel Density</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${badgeConfig.badgeBg} ${badgeConfig.badgeText}`}
        >
          <IconComponent className="w-3 h-3" />
          {badgeConfig.label}
        </span>
      </div>

      <div className="flex items-baseline justify-between bg-white p-2.5 rounded-lg border border-[#E2E8F0] shadow-2xs">
        <span className="text-[#64748B] font-mono">Retinal Vessel Density:</span>
        <span className="font-mono font-bold text-base text-[#0F172A]">
          {densityPct.toFixed(2)}%
        </span>
      </div>

      <p className={`text-[11px] leading-relaxed font-sans ${badgeConfig.text}`}>
        {assessment?.description ?? `Retinal vessel density (${densityPct.toFixed(2)}%) measured as positive vessel pixels over total valid Field-of-View pixels.`}
      </p>

      {/* Mandatory Non-Diagnostic Research Disclaimer */}
      <div className="bg-white/95 border border-[#E2E8F0] rounded-lg p-2.5 text-[10px] text-[#475569] leading-relaxed shadow-2xs">
        <span className="font-semibold text-[#0F172A]">Research Disclaimer: </span>
        Mask-derived image statistic. This exploratory measurement does not infer clinical diabetic retinopathy, ischemia, or vascular perfusion status. Clinical assessment requires validated ophthalmic diagnostics.
      </div>

      {/* Exploratory Population Reference Bands */}
      <div className="pt-2 border-t border-black/5 text-[10px] font-mono text-[#64748B] space-y-1">
        <div className="font-sans font-semibold text-[#0F172A] text-[10px] uppercase tracking-wider">
          Exploratory Reference Intervals (Non-Diagnostic):
        </div>
        <div className="flex justify-between">
          <span>8.0% &ndash; 16.0%:</span>
          <span className="text-emerald-700 font-semibold">Typical classical DIP fundus range</span>
        </div>
        <div className="flex justify-between">
          <span>&lt; 8.0%:</span>
          <span className="text-amber-700 font-semibold">Sub-nominal density band</span>
        </div>
        <div className="flex justify-between">
          <span>&gt; 16.0%:</span>
          <span className="text-amber-700 font-semibold">Elevated density band</span>
        </div>
      </div>
    </div>
  );
};
