'use client';

import type { IntersectionModel, IntersectionSource } from '@/app/lib/intersection';
import { PALM_AREA_KEYS, PALM_AREA_LABELS, type PalmConfidence, type PalmReading } from '@/app/lib/palmReading';
import { PALM_DISCLAIMER } from '@/app/lib/palmPresentation';

// ── Palm V2 통합 결과 표시 ────────────────────────────────────────────────────
// A. 핵심 패턴 요약 / B. 손금 상세 해석 / C·D. 교집합 근거와 보완·대비. 계산은 하지 않고 저장된 모델만 그린다.

const card = 'rounded-2xl bg-slate-900/60 border border-slate-800/60 p-5';
const CONFIDENCE_TEXT: Record<PalmConfidence, string> = { high: '선명함', medium: '대체로 보임', low: '희미함' };

const sourceList = (sources: IntersectionSource[]) =>
  sources.map((s) => (s.detail ? `${s.label}(${s.detail})` : s.label)).join(' · ');

export function CorePatternSummary({ model }: { model: IntersectionModel }) {
  const top = model.common.slice(0, 3);
  return (
    <section className={`${card} border-purple-500/25`}>
      <p className="text-[10px] tracking-[0.4em] text-purple-400/80 uppercase">A · 나의 핵심 패턴</p>
      {top.length > 0 ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {top.map((p) => (
              <span key={p.trait} className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-100 text-sm font-semibold">
                {p.trait} <span className="text-purple-300/70 text-xs font-normal">{p.sources.length}개 소스</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            {model.sourceCount}개 분석 소스{model.palmIncluded ? '(손금 포함)' : ''}를 함께 비교했을 때 가장 여러 번 겹친 패턴입니다.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-300">여러 소스에서 반복된 패턴은 없었습니다. 아래에서 소스별로 다른 면을 살펴보세요.</p>
      )}
    </section>
  );
}

export function PalmReadingCard({ reading }: { reading: PalmReading }) {
  return (
    <section className={`${card} border-violet-500/25`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">✋ 손금 상세 해석</h3>
      {reading.quality.summary && <p className="mt-1 text-xs text-slate-500">{reading.quality.summary}</p>}
      {reading.quality.usability === 'unusable' ? (
        <p className="mt-3 text-sm text-amber-300/90">이 사진에서는 손금을 판독하기 어려웠습니다. 손금은 교집합에서 제외했습니다.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {PALM_AREA_KEYS.map((k) => {
            const a = reading.areas[k];
            return (
              <div key={k} className="border-t border-slate-800/70 pt-3 first:border-0 first:pt-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-violet-200">{PALM_AREA_LABELS[k]}</p>
                  <span className="text-[10px] text-slate-500">
                    {a.status === 'observed' ? `관찰 신뢰도: ${CONFIDENCE_TEXT[a.confidence]}` : '판독 어려움'}
                  </span>
                </div>
                {a.status === 'observed' ? (
                  <>
                    <p className="mt-2 text-[11px] text-slate-500">사진에서 보이는 특징</p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-slate-300 space-y-0.5">
                      {a.observedFeatures.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                    <p className="mt-2 text-[11px] text-slate-500">전통 손금의 상징적 해석</p>
                    <p className="mt-1 text-sm text-slate-200 leading-relaxed">{a.interpretation}</p>
                    {a.traitCandidates.length > 0 && (
                      <p className="mt-2 text-xs text-violet-300/80">
                        교집합 후보: {a.traitCandidates.join(' · ')}{a.confidence === 'low' ? ' (신뢰도가 낮아 교집합에서는 제외)' : ''}
                      </p>
                    )}
                  </>
                ) : null}
                {a.limitations.length > 0 && <p className="mt-1 text-[11px] text-slate-500">한계: {a.limitations.join(' · ')}</p>}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-[10px] text-slate-600 leading-relaxed">{PALM_DISCLAIMER}</p>
    </section>
  );
}

export function IntersectionDetail({ model }: { model: IntersectionModel }) {
  const palmOnly = model.complements.filter((c) => c.sources[0]?.source === 'palm');
  const others = model.complements.filter((c) => c.sources[0]?.source !== 'palm');
  return (
    <section className={card}>
      <p className="text-[10px] tracking-[0.4em] text-purple-400/80 uppercase">C · 교집합 패턴과 근거</p>
      {model.common.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {model.common.map((p) => (
            <li key={p.trait} className="text-sm text-slate-200">
              <span className="font-semibold text-purple-200">{p.trait}</span>
              <span className="text-slate-500"> — </span>
              <span className="text-xs text-slate-400">{sourceList(p.sources)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">두 개 이상의 소스에서 겹친 의미가 없습니다.</p>
      )}

      <p className="mt-6 text-[10px] tracking-[0.4em] text-purple-400/80 uppercase">D · 서로 보완하거나 다른 방향의 해석</p>
      {palmOnly.length > 0 && (
        <p className="mt-3 text-sm text-slate-300">
          <span className="text-violet-300">손금에서만 보인 면:</span> {palmOnly.map((c) => `${c.trait}(${c.sources[0].detail})`).join(', ')}
        </p>
      )}
      {others.length > 0 && (
        <p className="mt-2 text-sm text-slate-300">
          <span className="text-slate-400">한 소스에서만 보인 면:</span> {others.map((c) => `${c.trait}(${c.sources[0].label})`).join(', ')}
        </p>
      )}
      {model.tensions.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {model.tensions.map((t) => (
            <li key={t.traits.join('-')} className="text-sm text-slate-300 leading-relaxed">
              <span className="text-amber-200">{t.traits[0]}</span> ↔ <span className="text-amber-200">{t.traits[1]}</span>
              <span className="block text-xs text-slate-500">
                {sourceList(t.sides[0])} / {sourceList(t.sides[1])} — 함께 존재할 수 있는 서로 다른 방향입니다.
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-500">소스 사이에 뚜렷하게 다른 방향의 해석은 없었습니다.</p>
      )}
      {model.palmExcludedAreas.length > 0 && (
        <p className="mt-4 text-[11px] text-slate-500">
          판독이 어렵거나 신뢰도가 낮아 교집합에서 제외한 손금 영역: {model.palmExcludedAreas.map((k) => PALM_AREA_LABELS[k]).join(' · ')}
        </p>
      )}
    </section>
  );
}
