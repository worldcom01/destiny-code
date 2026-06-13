/**
 * PlatformFooter — site-wide "Destiny Lab" platform identity block.
 * Shown on both input and result views to reinforce the multi-service platform feel.
 */
export function PlatformFooter() {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-3 mb-3">
        <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-800" />
        <span className="text-slate-800 text-[9px]">◈</span>
        <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-800" />
      </div>

      <p className="text-sm font-bold text-slate-300 tracking-wide mb-1">Destiny Lab</p>
      <p className="text-[11px] text-slate-600 mb-2">운명교집합 · 탄생디자인 · 운명궁합</p>
      <p className="text-[10px] tracking-[0.18em] text-slate-700">
        Powered by{' '}
        <span className="text-amber-500/45 font-medium tracking-[0.22em]">DESTINY CODE LAB</span>
      </p>
    </div>
  );
}
