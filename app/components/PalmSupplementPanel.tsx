'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { activeBaseRef, buildPalmSupplementFor, saveActive, type ActiveAnalysis } from '@/app/lib/activeAnalysis';
import { PalmAttemptTracker } from '@/app/lib/palmAttempt';
import { trackPalmEvent } from '@/app/lib/palmAnalytics';
import { ensurePalmSession, requestPalmObservation } from '@/app/lib/palmClient';
import {
  checkPalmFile, palmErrorMessage, palmObservationRows, palmQualityNote,
  PALM_ACCEPT, PALM_DISCLAIMER, PALM_FILE_MESSAGES, PALM_LINE_LABELS, PALM_MATCH_NOTE, PALM_NO_BASIS_NOTE,
  PALM_PROCESSING_NOTICE_DETAILS, PALM_PROCESSING_NOTICE_TEXT, PALM_SHARE_NOTE, type PalmFileProblem,
} from '@/app/lib/palmPresentation';
import type { PalmObservationBundle } from '@/app/lib/palmObservation';
import type { PalmComparisonKind, PalmSupplement } from '@/app/lib/palmSupplement';
import { readPalmSupplement, saveBaseThenPalm } from '@/app/lib/palmSupplementStore';

// ── 손바닥 패턴 분석 (Palm Phase 1C 보조 카드) ─────────────────────────────────
// 기본 결과가 표시된 뒤의 선택 기능이다. 기본 결과를 바꾸거나 다시 분석하지 않는다.
// 이 컴포넌트는 결과(baseRef)마다 key로 새로 mount된다 — A의 상태가 B에 남지 않는다.
// 사진은 사용자가 "손바닥 분석하기"를 누를 때만 업로드하고, 성공·취소·unmount 후 참조를 놓는다.

type Phase = 'idle' | 'selected' | 'processing' | 'done' | 'unusable' | 'error';

type Props = {
  active: ActiveAnalysis;
  storeVersion: number;                                // 페이지가 보조 기록을 저장하면 증가
  onPendingChange: (supplement: PalmSupplement | null) => void;
  onSaved: () => void;
};

const KIND_TITLES: Record<PalmComparisonKind, string> = {
  MATCH: '겹치는 관점',
  TENSION: '다른 방향의 관점',
  UNIQUE: '새롭게 살펴볼 관점',
};

export default function PalmSupplementPanel({ active, storeVersion, onPendingChange, onSaved }: Props) {
  const baseRef = activeBaseRef(active);
  const [localVersion, setLocalVersion] = useState(0);
  const stored = useMemo(() => {
    void storeVersion; void localVersion; // 저장 후 다시 읽기
    return readPalmSupplement(baseRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseRef?.kind, baseRef?.id, storeVersion, localVersion]);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileProblem, setFileProblem] = useState<PalmFileProblem | null>(null);
  const [noticeAcceptedAt, setNoticeAcceptedAt] = useState<string | null>(null);
  const [showNoticeDetails, setShowNoticeDetails] = useState(false);
  const [fresh, setFresh] = useState<PalmSupplement | null>(null);
  const [unusable, setUnusable] = useState<PalmObservationBundle | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hasFailedOnce, setHasFailedOnce] = useState(false);

  const trackerRef = useRef(new PalmAttemptTracker()); // 이 결과(mount) 전용
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<string | null>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tracker = trackerRef.current;
    ensurePalmSession().then((s) => {
      if (cancelled) return;
      setEnabled(s.enabled);
      if (s.enabled && !viewedRef.current) {
        viewedRef.current = true;
        trackPalmEvent('palm_prompt_viewed');
      }
    });
    return () => {
      cancelled = true;
      tracker.invalidate();               // 늦게 도착한 응답은 반영하지 않는다 (결과 이동·삭제 remount 포함)
      abortRef.current?.abort();          // 네트워크 abort가 provider 과금 취소를 보장하지는 않는다
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    };
  }, []);

  const releasePhoto = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setFile(null);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!picked) return; // 선택 취소 → 아무 요청 없음
    const problem = checkPalmFile(picked);
    setErrorCode(null);
    setSaveMessage(null);
    if (problem) {
      setFileProblem(problem);
      releasePhoto();
      setPhase('idle');
      return;
    }
    setFileProblem(null);
    releasePhoto();
    const url = URL.createObjectURL(picked);
    previewRef.current = url;
    setPreviewUrl(url);
    setFile(picked);
    setHasFailedOnce(false);
    setPhase('selected');
  };

  const analyze = async (isRetry: boolean) => {
    if (!file || !noticeAcceptedAt || phase === 'processing' || !baseRef) return;
    const tracker = trackerRef.current;
    const captured = tracker.begin(baseRef, crypto.randomUUID());
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('processing');
    setErrorCode(null);
    setSaveMessage(null);
    trackPalmEvent(isRetry ? 'palm_retry' : 'palm_started');

    const session = await ensurePalmSession();
    const isCurrent = () => tracker.isCurrent(captured, activeBaseRef(active));
    if (!isCurrent()) return;
    if (!session.enabled) {
      setEnabled(false);
      setErrorCode('UNAVAILABLE');
      setPhase('error');
      return;
    }
    const outcome = await requestPalmObservation(file, session.csrfToken, crypto.randomUUID(), controller.signal);
    if (!isCurrent()) return; // 다른 결과로 이동했거나, 결과가 삭제됐거나, 더 새 시도가 있음

    if (!outcome.ok) {
      if (outcome.code === 'ABORTED') return;
      if (outcome.code === 'SESSION_REQUIRED') void ensurePalmSession(true);
      setErrorCode(outcome.code);
      setHasFailedOnce(true);
      setPhase('error'); // 기존에 받은 성공 결과·기본 결과는 그대로 둔다
      return;
    }
    if (outcome.bundle.quality.usability === 'unusable') {
      setUnusable(outcome.bundle);
      releasePhoto();
      setPhase('unusable');
      return;
    }
    const supplement = buildPalmSupplementFor(active, outcome.bundle, {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      noticeAcceptedAt,
    });
    if (!supplement) {
      setErrorCode('UNAVAILABLE');
      setPhase('error');
      return;
    }
    setUnusable(null);
    setFresh(supplement);
    onPendingChange(supplement);
    releasePhoto(); // 결과를 받은 뒤 사진 참조를 놓는다
    setPhase('done');
  };

  const saveFresh = () => {
    if (!fresh) return;
    // 기본 결과 저장(이미 저장돼 있으면 그대로) → 성공했을 때만 보조 기록. 실패해도 받은 결과는 메모리에 남아
    // 다시 저장할 수 있다 (provider 재호출 없음).
    const r = saveBaseThenPalm(() => saveActive(active), baseRef, fresh);
    if (r.base === 'failed') {
      setSaveMessage('기본 결과를 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 저장해 주세요.');
      return;
    }
    if (r.palm.ok) {
      setLocalVersion((v) => v + 1);
      setSaveMessage('손바닥 결과를 이 기기에 저장했습니다.');
      onSaved();
    } else {
      setSaveMessage(r.palm.reason === 'storage-failed'
        ? '기본 결과는 저장됐지만 손바닥 결과는 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 저장해 주세요.'
        : '손바닥 결과를 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  const storedSupplement = stored.status === 'ok' ? stored.supplement : null;
  const freshSaved = !!fresh && storedSupplement?.id === fresh.id;
  const shown = fresh ?? storedSupplement;

  if (!baseRef) return null;
  if (enabled === false && !shown && stored.status !== 'unsupported') return null;

  const busy = phase === 'processing';

  return (
    <section
      aria-labelledby="palm-title"
      className="bg-slate-900/60 border border-teal-500/20 rounded-2xl p-5 space-y-4 opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
      style={{ animationDelay: '900ms' }}
    >
      <div className="text-center space-y-1">
        <p className="text-teal-400/70 text-[9px] tracking-[0.45em] uppercase">Palm Pattern</p>
        <h2 id="palm-title" className="text-slate-100 text-base font-semibold">손바닥 패턴 분석</h2>
        <p className="text-slate-500 text-xs">손바닥 사진으로 선의 흐름을 관찰하고, 지금의 운명 코드와 함께 살펴봅니다.</p>
      </div>

      {stored.status === 'unsupported' && (
        <p className="text-xs text-amber-300/80 text-center">저장된 손바닥 결과는 이 버전에서 표시할 수 없습니다. 기본 결과는 그대로입니다.</p>
      )}

      {shown && <PalmResult supplement={shown} />}

      {fresh && !freshSaved && (
        <div className="flex flex-col items-center gap-1.5">
          <button onClick={saveFresh} className="px-4 py-2 rounded-xl text-xs font-medium border border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 transition-colors">
            {storedSupplement ? '새 손바닥 결과로 저장' : '손바닥 결과 저장'}
          </button>
          <p className="text-[11px] text-slate-600">저장하면 관찰·해석만 이 기기에 보관됩니다. 사진은 저장하지 않습니다.</p>
        </div>
      )}
      {saveMessage && <p className="text-xs text-center text-slate-400" role="status">{saveMessage}</p>}

      {enabled && (
        <div className="space-y-3 border-t border-slate-800 pt-4">
          {phase !== 'processing' && !file && (
            <>
              <ul className="text-[12px] text-slate-400 leading-relaxed grid grid-cols-2 gap-x-3 gap-y-1">
                <li>· 손바닥이 카메라를 향하게</li>
                <li>· 한 손만, 손가락은 자연스럽게 펴서</li>
                <li>· 손끝부터 손목까지 모두 보이게</li>
                <li>· 밝은 곳에서 초점을 맞춰</li>
                <li>· 강한 반사·가림 없이</li>
                <li>· JPEG·PNG·WebP, 4MB 이하</li>
              </ul>
              <div className="flex gap-2 justify-center">
                <label className="px-4 py-2 rounded-xl text-xs font-medium border border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 cursor-pointer transition-colors">
                  사진 촬영
                  <input type="file" accept={PALM_ACCEPT} capture="environment" className="sr-only" onChange={onPick} />
                </label>
                <label className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-700/50 text-slate-300 hover:border-teal-500/30 cursor-pointer transition-colors">
                  사진 선택
                  <input type="file" accept={PALM_ACCEPT} className="sr-only" onChange={onPick} />
                </label>
              </div>
              <p className="text-[11px] text-slate-600 text-center">iPhone은 HEIC 대신 JPEG(설정 › 카메라 › 포맷 › 높은 호환성) 사진을 사용해 주세요.</p>
            </>
          )}
          {fileProblem && <p className="text-xs text-amber-300/80 text-center" role="alert">{PALM_FILE_MESSAGES[fileProblem]}</p>}

          {file && previewUrl && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 object URL 미리보기 */}
              <img src={previewUrl} alt="선택한 손바닥 사진 미리보기" className="mx-auto max-h-56 rounded-xl border border-slate-700/50 object-contain" />
              <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-3 space-y-2">
                <p className="text-[12px] text-slate-300 leading-relaxed">{PALM_PROCESSING_NOTICE_TEXT}</p>
                <button type="button" onClick={() => setShowNoticeDetails((v) => !v)} className="text-[11px] text-teal-400/80 underline underline-offset-2">
                  {showNoticeDetails ? '상세 안내 접기' : '상세 안내 보기'}
                </button>
                {showNoticeDetails && (
                  <ul className="text-[11px] text-slate-500 leading-relaxed space-y-0.5">
                    {PALM_PROCESSING_NOTICE_DETAILS.map((d) => <li key={d}>· {d}</li>)}
                  </ul>
                )}
                <label className="flex items-center gap-2 text-[12px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={!!noticeAcceptedAt}
                    disabled={busy}
                    onChange={(e) => setNoticeAcceptedAt(e.target.checked ? new Date().toISOString() : null)}
                  />
                  위 안내를 확인했습니다
                </label>
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => analyze(hasFailedOnce)}
                  disabled={!noticeAcceptedAt || busy}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-teal-400/40 bg-teal-500/15 text-teal-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-teal-500/25 transition-colors"
                >
                  {busy ? '분석 중…' : hasFailedOnce ? '다시 시도' : '손바닥 분석하기'}
                </button>
                <button onClick={() => { releasePhoto(); setPhase('idle'); setErrorCode(null); }} disabled={busy}
                  className="px-4 py-2 rounded-xl text-xs border border-slate-700/50 text-slate-400 disabled:opacity-40">
                  다른 사진 선택
                </button>
              </div>
            </div>
          )}

          {busy && <p className="text-xs text-teal-300/80 text-center" role="status">손바닥 선을 관찰하고 있습니다. 잠시만 기다려 주세요.</p>}
          {phase === 'error' && errorCode && <p className="text-xs text-amber-300/80 text-center" role="alert">{palmErrorMessage(errorCode)}</p>}
          {phase === 'unusable' && unusable && (
            <p className="text-xs text-amber-300/80 text-center" role="alert">{palmQualityNote(unusable)}</p>
          )}
        </div>
      )}
      {enabled === false && shown && <p className="text-[11px] text-slate-600 text-center">지금은 새 손바닥 분석을 이용할 수 없습니다.</p>}

      <div className="border-t border-slate-800 pt-3 space-y-1">
        <p className="text-[11px] text-slate-500 text-center leading-relaxed">{PALM_DISCLAIMER}</p>
        <p className="text-[11px] text-slate-600 text-center">{PALM_SHARE_NOTE}</p>
      </div>
    </section>
  );
}

function PalmResult({ supplement }: { supplement: PalmSupplement }) {
  const rows = palmObservationRows(supplement.bundle);
  const note = palmQualityNote(supplement.bundle);
  const byKind = (kind: PalmComparisonKind) => supplement.comparison.items.filter((i) => i.kind === kind);
  const lineOf = (signalId: string) => supplement.interpretation.signals.find((s) => s.id === signalId)?.line;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-slate-400 text-[11px] tracking-[0.3em] uppercase">관찰된 주요 패턴</p>
        {note && <p className="text-[11px] text-slate-500">{note}</p>}
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.line} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-slate-300 shrink-0">{r.name}<span className="text-slate-600 text-[11px] ml-1">({r.hint})</span></span>
              <span className={`text-right text-[12px] ${r.readable ? 'text-slate-400' : 'text-slate-600'}`}>{r.summary}</span>
            </li>
          ))}
        </ul>
      </div>

      {supplement.interpretation.signals.length > 0 && (
        <div className="space-y-2">
          <p className="text-slate-400 text-[11px] tracking-[0.3em] uppercase">상징적 해석</p>
          <ul className="space-y-2">
            {supplement.interpretation.signals.map((s) => (
              <li key={s.id} className="text-sm text-slate-300 leading-relaxed">
                <span className="text-teal-300/80 text-[12px] mr-1.5">{PALM_LINE_LABELS[s.line].name}</span>{s.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-slate-400 text-[11px] tracking-[0.3em] uppercase">기존 운명 코드와의 교집합</p>
        {supplement.comparison.basis === 'unavailable' ? (
          <p className="text-[12px] text-slate-500">{PALM_NO_BASIS_NOTE}</p>
        ) : supplement.comparison.items.length === 0 ? (
          <p className="text-[12px] text-slate-500">이 사진에서는 비교할 만큼 읽힌 선이 없었습니다.</p>
        ) : (
          <>
            <p className="text-[11px] text-slate-600">{PALM_MATCH_NOTE}</p>
            {(['MATCH', 'TENSION', 'UNIQUE'] as const).map((kind) => byKind(kind).length > 0 && (
              <div key={kind} className="space-y-1">
                <p className="text-[12px] text-teal-300/80">{KIND_TITLES[kind]}</p>
                <ul className="space-y-1">
                  {byKind(kind).map((item) => {
                    const line = lineOf(item.signalId);
                    return (
                      <li key={item.id} className="text-[13px] text-slate-400 leading-relaxed">
                        {line && <span className="text-slate-500 mr-1">{PALM_LINE_LABELS[line].name} ·</span>}{item.text}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
