'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { analyzeDestiny, type TarotResult } from '@/app/lib/analysis';
import { LOCATION_OPTION_GROUPS, findLocationByLabel } from '@/app/lib/regions';
import {
  getSavedAnalyses,
  deleteAnalysis,
  formatSavedDate,
  type SavedAnalysis,
} from '@/app/lib/storageEngine';
import { shareResult, type ShareOutcome } from '@/app/lib/shareEngine';
import {
  activeBaseRef,
  activeFromNewAnalysis,
  activeFromSaved,
  activeDestinyCode,
  activeShareText,
  saveActive,
  type ActiveAnalysis,
} from '@/app/lib/activeAnalysis';
import type { PalmSupplement } from '@/app/lib/palmSupplement';
import { deletePalmSupplement, prunePalmSupplements, savedBaseRef, saveBaseThenPalm } from '@/app/lib/palmSupplementStore';
import { shouldResetPalmOnDelete } from '@/app/lib/palmAttempt';
import PalmSupplementPanel from '@/app/components/PalmSupplementPanel';
import PalmPhotoInput, { type PalmPhoto } from '@/app/components/PalmPhotoInput';
import ResultFirst from '@/app/components/ResultFirst';
import { ensurePalmSession, requestPalmObservation } from '@/app/lib/palmClient';
import { palmErrorMessage } from '@/app/lib/palmPresentation';
import type { PalmReading } from '@/app/lib/palmReading';
import { shuffleCards } from '@/app/lib/tarotEngine';
import { generateDestinyCode } from '@/app/lib/destinyCode';
import { saveProfile } from '@/app/lib/profileStore';
import { saveAnalyticsResult } from '@/app/lib/analyticsEngine';
import { SiteHeader } from '@/app/components/SiteHeader';
import { PlatformFooter } from '@/app/components/PlatformFooter';

const MBTI_OPTIONS = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

interface FormData {
  name: string;
  solarType: 'solar' | 'lunar';
  isLeapMonth: boolean;
  year: string;
  month: string;
  day: string;
  birthHour: string;
  birthplace: string;
  gender: string;
  mbti: string;
  bloodtype: string;
}

const CURRENT_YEAR = new Date().getFullYear();

const SIJU_LIST = [
  { value: '자시', label: '자시 (子時)  23:31 ~ 01:30' },
  { value: '축시', label: '축시 (丑時)  01:31 ~ 03:30' },
  { value: '인시', label: '인시 (寅時)  03:31 ~ 05:30' },
  { value: '묘시', label: '묘시 (卯時)  05:31 ~ 07:30' },
  { value: '진시', label: '진시 (辰時)  07:31 ~ 09:30' },
  { value: '사시', label: '사시 (巳時)  09:31 ~ 11:30' },
  { value: '오시', label: '오시 (午時)  11:31 ~ 13:30' },
  { value: '미시', label: '미시 (未時)  13:31 ~ 15:30' },
  { value: '신시', label: '신시 (申時)  15:31 ~ 17:30' },
  { value: '유시', label: '유시 (酉時)  17:31 ~ 19:30' },
  { value: '술시', label: '술시 (戌時)  19:31 ~ 21:30' },
  { value: '해시', label: '해시 (亥時)  21:31 ~ 23:30' },
];

const SIJU_TIME_MAP: Record<string, string> = {
  자시: '00:30', 축시: '02:30', 인시: '04:30', 묘시: '06:30',
  진시: '08:30', 사시: '10:30', 오시: '12:30', 미시: '14:30',
  신시: '16:30', 유시: '18:30', 술시: '20:30', 해시: '22:30',
};

type AppStep = 'form' | 'picking' | 'analyzing' | 'result';

const LOADING_STEPS = [
  '사주 · 서양점성술 분석 중',
  '혈액형 · MBTI 성향 매핑 중',
  '선택된 타로 카드 연결 중',
  '운명 교집합 키워드 도출 중',
  'AI 종합 해석 생성 중',
];

// ── 타로 카드 선택 화면 ──────────────────────────────────────────────────────
function TarotPickerScreen({ cards, onPick }: { cards: TarotResult[]; onPick: (card: TarotResult) => void }) {
  const [flippedIdx, setFlippedIdx] = useState<number | null>(null);
  const [dimmed, setDimmed] = useState(false);
  const [fading, setFading] = useState(false);

  const handlePick = (idx: number) => {
    if (flippedIdx !== null) return;
    setFlippedIdx(idx);
    setDimmed(true);
    setTimeout(() => {
      setFading(true);
      setTimeout(() => onPick(cards[idx]), 350);
    }, 1050);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 transition-opacity duration-350 ${fading ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'rgba(2, 2, 18, 0.97)' }}
    >
      {/* 배경 글로우 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center mb-8 opacity-0 [animation:fadeInUp_0.5s_ease-out_0.2s_forwards]">
        <p className="text-amber-400/60 text-[10px] tracking-[0.3em] uppercase mb-3">✦ 운명의 카드 ✦</p>
        <h2 className="text-2xl font-bold text-white mb-2">카드를 선택하세요</h2>
        <p className="text-slate-500 text-sm">직관이 이끄는 대로 하나를 골라보세요</p>
      </div>

      <div className="relative grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-xs sm:max-w-sm opacity-0 [animation:fadeInUp_0.5s_ease-out_0.45s_forwards]">
        {cards.map((card, idx) => {
          const isFlipped = flippedIdx === idx;
          const isDimmed = dimmed && !isFlipped;
          return (
            <div
              key={idx}
              className={`select-none transition-all duration-500
                ${isDimmed
                  ? 'opacity-15 scale-90 pointer-events-none'
                  : isFlipped
                    ? 'scale-105'
                    : 'cursor-pointer hover:-translate-y-1.5 hover:shadow-lg hover:shadow-amber-500/25'
                }`}
              style={{ perspective: '1200px' }}
              onClick={() => handlePick(idx)}
            >
              {/* 3D flip container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingBottom: '150%',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.85s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* 카드 뒷면 */}
                <div
                  style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}
                  className="rounded-xl bg-gradient-to-b from-[#050520] to-[#100825] border border-amber-400/35 flex flex-col items-center justify-center overflow-hidden"
                >
                  <span className="absolute top-2 left-2 text-amber-400/35 text-[9px]">✦</span>
                  <span className="absolute top-2 right-2 text-amber-400/35 text-[9px]">✦</span>
                  <span className="absolute bottom-2 left-2 text-amber-400/35 text-[9px]">✦</span>
                  <span className="absolute bottom-2 right-2 text-amber-400/35 text-[9px]">✦</span>
                  <div className="absolute inset-3 border border-amber-400/12 rounded-lg pointer-events-none" />
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-amber-300/40 text-[9px] tracking-widest">· · ·</span>
                    <span className="text-amber-300/65 text-xl">◎</span>
                    <span className="text-amber-300/40 text-[9px] tracking-widest">· · ·</span>
                  </div>
                </div>

                {/* 카드 앞면 */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                  className="rounded-xl bg-gradient-to-b from-violet-950 to-[#1a0840] border-2 border-amber-400/65 flex flex-col items-center justify-center gap-1 shadow-xl shadow-violet-900/60 overflow-hidden"
                >
                  <span className="text-amber-400/85 text-[9px] font-mono tracking-widest">{card.romanNumeral}</span>
                  <span className="text-violet-200 text-2xl leading-none">{card.symbol}</span>
                  <span className="text-amber-200/90 text-[9px] font-semibold text-center px-1 leading-tight mt-0.5">{card.name}</span>
                  <span className="text-violet-400/55 text-[7px] text-center px-1">{card.nameEn}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 로딩 패널 ────────────────────────────────────────────────────────────────
function LoadingPanel({ step }: { step: number }) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-purple-500/20 rounded-2xl p-8 shadow-2xl shadow-purple-950/40 text-center">
      <div className="relative w-20 h-20 mx-auto mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 animate-ping" />
        <div className="absolute inset-1 rounded-full border-2 border-t-purple-400 border-r-indigo-400 border-b-transparent border-l-transparent animate-spin" />
        <div
          className="absolute inset-3 rounded-full border border-t-indigo-300 border-r-transparent border-b-purple-300 border-l-transparent animate-spin"
          style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-purple-300 text-2xl animate-pulse">
          ✦
        </div>
      </div>

      <p className="text-purple-300 text-sm font-medium mb-6 tracking-wide">
        {LOADING_STEPS[step]}...
      </p>

      <div className="space-y-2.5 text-left max-w-xs mx-auto mb-6">
        {LOADING_STEPS.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 text-xs transition-all duration-500 ${
              i < step ? 'text-purple-400' : i === step ? 'text-white' : 'text-slate-700'
            }`}
          >
            <span className="w-4 text-center flex-shrink-0">
              {i < step ? '✓' : i === step ? '◉' : '○'}
            </span>
            <span>{s}</span>
          </div>
        ))}
      </div>

      <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${((step + 1) / LOADING_STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function Home() {
  const [form, setForm] = useState<FormData>({
    name: '',
    solarType: 'solar',
    isLeapMonth: false,
    year: '',
    month: '',
    day: '',
    birthHour: '',
    birthplace: '',
    gender: '',
    mbti: '',
    bloodtype: '',
  });
  const [appStep, setAppStep] = useState<AppStep>('form');
  const [loadingStep, setLoadingStep] = useState(0);
  const [shuffledCards, setShuffledCards] = useState<TarotResult[]>([]);
  // 표시 중인 결과와 그 메타데이터. 새 분석은 AnalysisSnapshot, 구버전 저장 결과는 AnalysisOutput
  const [active, setActive] = useState<ActiveAnalysis | null>(null);
  const [savedList, setSavedList] = useState<SavedAnalysis[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [shareStatus, setShareStatus] = useState<ShareOutcome | 'idle'>('idle');
  const resultRef = useRef<HTMLDivElement>(null);
  // Palm 보조 결과: 저장 전 성공본(이 결과에 속한 것만)과 보조 저장 알림. 기본 결과와 별개다.
  const [pendingPalm, setPendingPalm] = useState<PalmSupplement | null>(null);
  const [palmStoreVersion, setPalmStoreVersion] = useState(0);
  const [palmSaveNote, setPalmSaveNote] = useState<string | null>(null);
  // 활성 결과를 삭제하면 증가 → Palm 카드를 remount해 진행 중 요청·미저장 결과·미리보기를 버린다
  const [palmGeneration, setPalmGeneration] = useState(0);
  // Palm V2: 입력 단계에서 고른 손바닥 사진(분석 후 즉시 놓는다)과 손금 분석 상태 안내
  const [palmPhoto, setPalmPhoto] = useState<PalmPhoto | null>(null);
  const [palmPending, setPalmPending] = useState(false);
  const [palmNotice, setPalmNotice] = useState<string | null>(null);

  useEffect(() => {
    prunePalmSupplements(); // 삭제·10개 제한으로 사라진 결과의 보조 기록 정리
    setSavedList(getSavedAnalyses());
  }, []);

  useEffect(() => {
    if (!form.year || !form.month || !form.day) return;
    const max = new Date(Number(form.year), Number(form.month), 0).getDate();
    if (Number(form.day) > max) setForm((prev) => ({ ...prev, day: String(max) }));
  }, [form.year, form.month]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const setField = (k: keyof FormData, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    setActive(null);
    setPendingPalm(null);
    setPalmSaveNote(null);
    setPalmNotice(null);
    setSaveStatus('idle');
    setShuffledCards(shuffleCards(9));
    setAppStep('picking');
  };

  // 손금은 카드 선택 직후 바로 요청해 로딩 단계와 겹쳐 진행한다. 실패해도 기존 분석은 그대로 진행한다.
  const requestPalm = async (blob: Blob): Promise<{ reading: PalmReading } | { error: string }> => {
    const session = await ensurePalmSession();
    if (!session.enabled) return { error: 'UNAVAILABLE' };
    let outcome = await requestPalmObservation(blob, session.csrfToken, crypto.randomUUID(), AbortSignal.timeout(70_000));
    if (!outcome.ok && outcome.code === 'SESSION_REQUIRED') {
      const fresh = await ensurePalmSession(true);
      if (fresh.enabled) outcome = await requestPalmObservation(blob, fresh.csrfToken, crypto.randomUUID(), AbortSignal.timeout(70_000));
    }
    return outcome.ok ? { reading: outcome.reading } : { error: outcome.code };
  };

  const handleCardPicked = async (card: TarotResult) => {
    setAppStep('analyzing');
    setLoadingStep(0);
    const photo = palmPhoto;
    const palmPromise = photo ? requestPalm(photo.blob) : Promise.resolve(null);
    setPalmPending(!!photo);

    for (let i = 1; i < LOADING_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 500));
      setLoadingStep(i);
    }
    await new Promise((r) => setTimeout(r, 300));

    const birthdate = `${form.year}-${form.month.padStart(2, '0')}-${form.day.padStart(2, '0')}`;
    const birthtime = SIJU_TIME_MAP[form.birthHour] ?? '';
    const location = findLocationByLabel(form.birthplace);
    const palmOutcome = await palmPromise;
    setPalmPending(false);
    let palmReading: PalmReading | undefined;
    if (palmOutcome && 'reading' in palmOutcome) palmReading = palmOutcome.reading;
    else if (palmOutcome) setPalmNotice(`손금 분석을 하지 못해 기존 정보로만 분석했습니다. ${palmErrorMessage(palmOutcome.error)}`);
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl); // 사진 참조를 놓는다 — 결과에는 판독 내용만 남는다
      setPalmPhoto(null);
    }
    const analysisResult = analyzeDestiny(
      birthdate,
      birthtime,
      form.mbti,
      form.gender,
      form.bloodtype,
      card,
      location?.lat,
      location?.lon,
      form.solarType,
      form.isLeapMonth,
      palmReading,
    );
    setPendingPalm(null);
    setPalmSaveNote(null);
    setActive(activeFromNewAnalysis(analysisResult, {
      nickname: form.name,
      birthdate,
      mbti: form.mbti,
      bloodtype: form.bloodtype,
    }));

    const code = generateDestinyCode(analysisResult);
    const wa = analysisResult.westernAstrology;
    saveProfile({
      code,
      nickname: form.name || undefined,
      archetype: analysisResult.archetype,
      identityStatement: analysisResult.identityStatement,
      commonKeywords: analysisResult.commonKeywords,
      coreTags: analysisResult.coreTags,
      mbti: analysisResult.mbtiTraits.type,
      bloodType: analysisResult.bloodType.type,
      tarotName: analysisResult.tarot.name,
      dayStem: analysisResult.saju.dayStem,
      zodiacSign: analysisResult.zodiac.sign,
      zodiacSignEn: analysisResult.zodiac.signEn,
      dominantElement: analysisResult.saju.dominantElement,
      createdAt: new Date().toISOString(),
      sunSign: wa.sun.data.sign,
      moonSign: wa.moon?.data.sign,
      ascendantSign: wa.ascendant?.data.sign,
    });
    console.log('[page] 생성된 운명 코드:', code, '/ localStorage 확인:', localStorage.getItem('destiny_profiles_v1'));

    setAppStep('result');
    saveAnalyticsResult(analysisResult, code); // 비동기 — 실패해도 UX에 영향 없음
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleSave = () => {
    if (!active) return;
    // 기본 결과를 먼저 저장하고, 성공했을 때만 이 결과의 저장 전 손바닥 결과를 별도로 저장한다
    // (원자적 저장을 가장하지 않음). 기본 저장 실패 시 보조 기록을 쓰지 않는다.
    setPalmSaveNote(null);
    const r = saveBaseThenPalm(() => saveActive(active), activeBaseRef(active), pendingPalm);
    if (r.base === 'failed') {
      setPalmSaveNote('결과를 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.');
      return;
    }
    if (r.palm.ok) {
      setPendingPalm(null);
      setPalmStoreVersion((v) => v + 1);
    } else if (r.palm.reason !== 'none' && r.palm.reason !== 'other-result') {
      setPalmSaveNote('기본 결과는 저장됐지만 손바닥 결과는 저장하지 못했습니다.');
    }
    prunePalmSupplements();
    setSaveStatus('saved');
    setSavedList(getSavedAnalyses());
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const handleShare = async () => {
    if (!active) return;
    const text = activeShareText(active);
    const outcome = await shareResult(text);
    setShareStatus(outcome);
    if (outcome !== 'failed') setTimeout(() => setShareStatus('idle'), 2500);
  };

  const handleViewSaved = (saved: SavedAnalysis) => {
    setActive(activeFromSaved(saved));
    setPendingPalm(null);
    setPalmSaveNote(null);
    setSaveStatus('idle');
    setShowHistory(false);
    setShareStatus('idle');
    setAppStep('result');
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleDeleteSaved = (id: string) => {
    const saved = savedList.find((s) => s.id === id);
    deleteAnalysis(id);
    if (saved) {
      deletePalmSupplement(savedBaseRef(saved)); // 삭제한 결과의 보조 기록도 함께 지운다
      // 지금 보고 있는 결과를 지웠다면 그 결과의 진행 중 Palm 요청·미저장 결과·미리보기를 모두 버린다
      if (active && shouldResetPalmOnDelete(activeBaseRef(active), savedBaseRef(saved))) {
        setPendingPalm(null);
        setPalmGeneration((g) => g + 1);
      }
    }
    prunePalmSupplements();
    setSavedList(getSavedAnalyses());
    setPalmStoreVersion((v) => v + 1);
  };

  const result = active?.result ?? null;
  const destinyCode = active ? activeDestinyCode(active) : '';
  const birthdateComputed = form.year && form.month && form.day
    ? `${form.year}-${form.month.padStart(2, '0')}-${form.day.padStart(2, '0')}`
    : '';
  const isFormValid = form.name && birthdateComputed && form.gender && form.bloodtype;

  const inputClass =
    'w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:bg-slate-800/90 transition-colors text-sm [color-scheme:dark]';
  const selectClass =
    'w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/60 focus:bg-slate-800/90 transition-colors text-sm [color-scheme:dark]';

  return (
    <div className={`min-h-screen text-white ${appStep === 'result' ? 'result-page' : 'bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950'}`}>
      {/* 타로 카드 선택 화면 (고정 오버레이) */}
      {appStep === 'picking' && (
        <TarotPickerScreen cards={shuffledCards} onPick={handleCardPicked} />
      )}

      {/* 플랫폼 헤더 */}
      <SiteHeader active="intersection" />

      {/* 배경 글로우 */}
      <div className={`fixed inset-0 pointer-events-none overflow-hidden ${appStep === 'result' ? 'hidden' : ''}`}>
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className={`relative mx-auto px-4 ${appStep === 'result' ? 'max-w-5xl py-6 sm:py-10' : 'max-w-2xl py-14'}`}>
        {/* 헤더 */}
        <header className={`text-center mb-12 ${appStep === 'result' ? 'hidden' : ''}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs mb-6 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            AI Destiny System
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight bg-gradient-to-r from-purple-300 via-indigo-200 to-purple-400 bg-clip-text text-transparent">
            AI 운명 교집합 분석
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            사주 · 서양점성술 · MBTI · 혈액형 · 타로의 교집합으로 발견하는
            <br className="hidden sm:block" />
            당신만의 운명 코드
          </p>
        </header>

        {/* 입력 폼 */}
        {appStep === 'form' && (
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/60 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6 md:p-8 mb-8 shadow-2xl shadow-purple-950/40"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-purple-300 mb-6 tracking-wide uppercase">
              <span className="text-purple-400">✦</span>
              기본 정보 입력
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase">
                  이름
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="이름을 입력하세요"
                  className={inputClass}
                  autoComplete="off"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">
                    생년월일
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-slate-700/50">
                    {(['solar', 'lunar'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setField('solarType', type)}
                        className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                          form.solarType === type
                            ? 'bg-purple-600/80 text-white'
                            : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {type === 'solar' ? '양력' : '음력'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setField('year', e.target.value)}
                    placeholder="년도"
                    min={1930}
                    max={CURRENT_YEAR}
                    className={`${inputClass} ${!form.year ? 'text-slate-500' : ''}`}
                  />
                  <select
                    value={form.month}
                    onChange={(e) => setField('month', e.target.value)}
                    className={`${selectClass} ${!form.month ? 'text-slate-500' : ''}`}
                  >
                    <option value="" disabled>월</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={String(m)}>{m}월</option>
                    ))}
                  </select>
                  <select
                    value={form.day}
                    onChange={(e) => setField('day', e.target.value)}
                    className={`${selectClass} ${!form.day ? 'text-slate-500' : ''}`}
                  >
                    <option value="" disabled>일</option>
                    {Array.from(
                      { length: form.year && form.month
                          ? new Date(Number(form.year), Number(form.month), 0).getDate()
                          : 31
                      },
                      (_, i) => i + 1,
                    ).map((d) => (
                      <option key={d} value={String(d)}>{d}일</option>
                    ))}
                  </select>
                </div>
                {form.solarType === 'lunar' && (
                  <label className="flex items-center gap-2 mt-2 text-[11px] text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.isLeapMonth}
                      onChange={(e) => setForm((prev) => ({ ...prev, isLeapMonth: e.target.checked }))}
                      className="accent-purple-600"
                    />
                    윤달(윤월)에 태어났어요
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase">
                  태어난 시간 <span className="text-slate-600 normal-case">(선택)</span>
                </label>
                <select
                  value={form.birthHour}
                  onChange={(e) => setField('birthHour', e.target.value)}
                  className={`${selectClass} ${!form.birthHour ? 'text-slate-500' : ''}`}
                >
                  <option value="" className="bg-slate-900 text-slate-500">시주를 선택하세요</option>
                  {SIJU_LIST.map((s) => (
                    <option key={s.value} value={s.value} className="bg-slate-900">{s.label}</option>
                  ))}
                  <option value="unknown" className="bg-slate-900 text-slate-400">모름</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase">
                  출생지 <span className="text-slate-600 normal-case">(선택 · 상승궁 계산)</span>
                </label>
                <p className="mb-1.5 text-[11px] text-slate-500">
                  출생지와 가장 가까운 지역을 선택해주세요.
                </p>
                <select
                  value={form.birthplace}
                  onChange={(e) => setField('birthplace', e.target.value)}
                  className={`${selectClass} ${!form.birthplace ? 'text-slate-500' : ''}`}
                >
                  <option value="" className="bg-slate-900 text-slate-500">출생지를 선택하세요</option>
                  {LOCATION_OPTION_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label} className="bg-slate-900 text-slate-400">
                      {group.options.map((opt) => (
                        <option key={opt.code} value={opt.label} className="bg-slate-900 text-white">
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] text-slate-700 leading-relaxed">
                  출생시간을 입력하면 보다 정확한 서양점성술 분석이 가능합니다. 출생지까지 입력하면 상승궁(Ascendant)이 계산됩니다.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase">
                  성별
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ value: 'male', label: '남자' }, { value: 'female', label: '여자' }].map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setField('gender', g.value)}
                      className={`py-3 rounded-xl text-sm font-medium border transition-all duration-200 ${
                        form.gender === g.value
                          ? 'bg-purple-600/30 border-purple-500/60 text-purple-200'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-500 hover:border-slate-600/70 hover:text-slate-300'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase">
                  혈액형
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['A', 'B', 'O', 'AB'].map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => setField('bloodtype', bt)}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                        form.bloodtype === bt
                          ? 'bg-rose-600/25 border-rose-500/50 text-rose-200'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-500 hover:border-slate-600/70 hover:text-slate-300'
                      }`}
                    >
                      {bt}형
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">
                    MBTI
                  </label>
                  <span className="group relative inline-block cursor-help">
                    <span className="text-[9px] text-slate-600/80 border border-slate-700/40 rounded px-1 py-0.5 font-mono leading-none select-none">
                      16P
                    </span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700/50 text-[10px] text-slate-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20 shadow-xl">
                      16Personalities 기준
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-700/50" />
                    </div>
                  </span>
                  <span className="ml-auto text-[10px] text-slate-600">선택사항 · 모르면 건너뛰어도 됩니다</span>
                </div>
                <select
                  name="mbti"
                  value={form.mbti}
                  onChange={handleChange}
                  className={`w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500/60 focus:bg-slate-800/90 transition-colors text-sm [color-scheme:dark] ${
                    form.mbti && form.mbti !== 'skip' ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  <option value="" disabled className="bg-slate-900 text-slate-500">
                    MBTI를 선택하세요
                  </option>
                  {MBTI_OPTIONS.map((type) => (
                    <option key={type} value={type} className="bg-slate-900 text-white">{type}</option>
                  ))}
                  <option disabled className="bg-slate-900 text-slate-700">─────────────</option>
                  <option value="skip" className="bg-slate-900 text-slate-400">잘 모름 / 선택 안 함</option>
                </select>
              </div>
            </div>

            <PalmPhotoInput photo={palmPhoto} onChange={setPalmPhoto} />

            <p className="mt-4 text-center text-[10px] text-slate-700">
              입력된 정보는 운명 흐름 분석에만 사용됩니다
            </p>

            <div className="mt-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-center gap-2.5">
              <span className="text-amber-400/70 text-base flex-shrink-0">✦</span>
              <p className="text-amber-300/60 text-xs leading-relaxed">
                다음 단계에서 직접 타로 카드를 선택하게 됩니다. 직관이 이끄는 대로 고르세요.
              </p>
            </div>

            <button
              type="submit"
              disabled={!isFormValid}
              className="mt-6 w-full py-4 rounded-xl font-semibold text-sm tracking-wide
                bg-gradient-to-r from-purple-600 to-indigo-600
                hover:from-purple-500 hover:to-indigo-500
                disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed
                text-white transition-all duration-300
                shadow-lg shadow-purple-950/60 hover:shadow-purple-900/40
                hover:-translate-y-0.5 active:translate-y-0"
            >
              카드 선택으로 이동 →
            </button>
          </form>
        )}

        {/* 로딩 */}
        {appStep === 'analyzing' && <LoadingPanel step={loadingStep} />}
        {appStep === 'analyzing' && palmPending && loadingStep >= LOADING_STEPS.length - 1 && (
          <p className="mt-3 text-center text-xs text-violet-300/80" role="status">손금을 자세히 읽는 중이에요. 보통 20~30초 걸립니다.</p>
        )}

        {/* 결과 */}
        {appStep === 'result' && result && (
          <div ref={resultRef} className="result-anchor">
            {palmSaveNote && <p className="result-notice" role="status">{palmSaveNote}</p>}
            {palmNotice && <p className="result-notice" role="status">{palmNotice}</p>}
            <ResultFirst
              key={active ? `${activeBaseRef(active)?.kind}:${activeBaseRef(active)?.id}` : 'result'}
              result={result} nickname={active?.meta.nickname ?? ''} code={destinyCode}
              saveStatus={saveStatus} shareStatus={shareStatus}
              onSave={handleSave} onShare={handleShare} onReset={() => setAppStep('form')}
            >
              {active && (() => {
                const ref = activeBaseRef(active);
                return ref && <PalmSupplementPanel
                  key={`${ref.kind}:${ref.id}:${palmGeneration}`}
                  active={active} storeVersion={palmStoreVersion}
                  onPendingChange={(s) => setPendingPalm(s)}
                  onSaved={() => { setPendingPalm(null); setSavedList(getSavedAnalyses()); }}
                />;
              })()}
            </ResultFirst>
          </div>
        )}

        {/* 분석 기록 */}
        {savedList.length > 0 && (
          <div className="saved-history bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 my-6">
            <button
              onClick={() => setShowHistory((h) => !h)}
              className="w-full flex items-center justify-between text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                저장된 분석 기록
                <span className="px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 text-[10px]">
                  {savedList.length}
                </span>
              </span>
              <span className="text-xs text-slate-600">{showHistory ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>

            {showHistory && (
              <div className="mt-4 space-y-3">
                {savedList.map((saved) => (
                  <div
                    key={saved.id}
                    className="flex items-start gap-3 p-4 bg-slate-900/70 border border-slate-700/30 rounded-xl hover:border-slate-600/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-slate-200 text-sm font-medium truncate">{saved.nickname}</span>
                        <span className="text-slate-600 text-[10px]">{formatSavedDate(saved.createdAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-2 text-xs text-slate-500">
                        <span>{saved.zodiacSign}</span>
                        <span className="text-slate-700">·</span>
                        <span>{saved.mbti}</span>
                        <span className="text-slate-700">·</span>
                        <span>{saved.bloodtype}형</span>
                        <span className="text-slate-700">·</span>
                        <span className="text-violet-400/70">{saved.tarotName}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {saved.keywords.map((kw) => (
                          <span
                            key={kw}
                            className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px]"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleViewSaved(saved)}
                        className="px-3 py-1.5 text-[10px] bg-purple-500/15 border border-purple-500/25 text-purple-300 rounded-lg hover:bg-purple-500/25 transition-colors whitespace-nowrap"
                      >
                        보기
                      </button>
                      <button
                        onClick={() => handleDeleteSaved(saved.id)}
                        className="px-3 py-1.5 text-[10px] bg-slate-800/60 border border-slate-700/30 text-slate-600 rounded-lg hover:text-red-400 hover:border-red-500/20 transition-colors whitespace-nowrap"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <footer className="text-center mt-14 space-y-5">
          <p className="text-slate-700 text-xs">
            AI 분석 결과는 참고용이며 실제 운명을 보장하지 않습니다
          </p>
          <PlatformFooter />
        </footer>
      </div>
    </div>
  );
}
