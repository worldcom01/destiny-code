'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { analyzeDestiny, type AnalysisOutput, type TarotResult, ELEMENT_META } from '@/app/lib/analysis';
import {
  saveAnalysis,
  getSavedAnalyses,
  deleteAnalysis,
  formatSavedDate,
  type SavedAnalysis,
} from '@/app/lib/storageEngine';
import { generateShareText, shareResult, type ShareOutcome } from '@/app/lib/shareEngine';
import { shuffleCards } from '@/app/lib/tarotEngine';
import { detectConflicts, type ConflictPattern } from '@/app/lib/conflictEngine';
import { computeKeywordStrengths, type KeywordStrength } from '@/app/lib/keywordEngine';
import { generateDestinyCode } from '@/app/lib/destinyCode';
import { saveProfile } from '@/app/lib/profileStore';

const MBTI_OPTIONS = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

interface FormData {
  name: string;
  solarType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  birthHour: string;
  gender: string;
  mbti: string;
  bloodtype: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: CURRENT_YEAR - 1929 }, (_, i) => CURRENT_YEAR - i);

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

const MBTI_CODE_LABELS: Record<string, string> = {
  INTJ: 'ARCHITECT',    INTP: 'ANALYST',      ENTJ: 'COMMANDER',    ENTP: 'DEBATER',
  INFJ: 'ADVOCATE',     INFP: 'MEDIATOR',     ENFJ: 'PROTAGONIST',  ENFP: 'CAMPAIGNER',
  ISTJ: 'LOGISTICIAN',  ISFJ: 'DEFENDER',     ESTJ: 'EXECUTIVE',    ESFJ: 'CONSUL',
  ISTP: 'VIRTUOSO',     ISFP: 'ADVENTURER',   ESTP: 'ENTREPRENEUR', ESFP: 'ENTERTAINER',
};

const DAY_STEM_LABELS: Record<string, string> = {
  '甲': 'PIONEER', '乙': 'ADAPTOR',  '丙': 'RADIANCE', '丁': 'ESSENCE',
  '戊': 'ANCHOR',  '己': 'NURTURER', '庚': 'STEEL',     '辛': 'CRYSTAL',
  '壬': 'TORRENT', '癸': 'WISDOM',
};

const ZODIAC_CODE_LABELS: Record<string, string> = {
  'Aries':       'SPARK',      'Taurus':      'STONE',       'Gemini':      'MIRROR',
  'Cancer':      'TIDE',       'Leo':         'FLAME',       'Virgo':       'PURE MIND',
  'Libra':       'SCALE',      'Scorpio':     'DEEP WATER',  'Sagittarius': 'ARROW',
  'Capricorn':   'SUMMIT',     'Aquarius':    'SIGNAL',      'Pisces':      'DREAM DRIFT',
};

const SIJU_TIME_MAP: Record<string, string> = {
  자시: '00:30', 축시: '02:30', 인시: '04:30', 묘시: '06:30',
  진시: '08:30', 사시: '10:30', 오시: '12:30', 미시: '14:30',
  신시: '16:30', 유시: '18:30', 술시: '20:30', 해시: '22:30',
};

type AppStep = 'form' | 'picking' | 'analyzing' | 'result';

const LOADING_STEPS = [
  '사주 · 별자리 분석 중',
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

// ── 결과 카드 ────────────────────────────────────────────────────────────────
function ResultCard({
  icon,
  title,
  children,
  hoverBorderClass,
  delay,
}: {
  icon: string;
  title: string;
  children: ReactNode;
  hoverBorderClass: string;
  delay: number;
}) {
  return (
    <div
      className={`group bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl p-6
        shadow-xl hover:shadow-2xl ${hoverBorderClass} hover:scale-[1.015]
        transition-all duration-300 cursor-default
        opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-4">
        <span className="text-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function Home() {
  const [form, setForm] = useState<FormData>({
    name: '',
    solarType: 'solar',
    year: '',
    month: '',
    day: '',
    birthHour: '',
    gender: '',
    mbti: '',
    bloodtype: '',
  });
  const [appStep, setAppStep] = useState<AppStep>('form');
  const [loadingStep, setLoadingStep] = useState(0);
  const [shuffledCards, setShuffledCards] = useState<TarotResult[]>([]);
  const [result, setResult] = useState<AnalysisOutput | null>(null);
  const [conflicts, setConflicts] = useState<ConflictPattern[]>([]);
  const [keywordStrengths, setKeywordStrengths] = useState<KeywordStrength[]>([]);
  const [savedList, setSavedList] = useState<SavedAnalysis[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [shareStatus, setShareStatus] = useState<ShareOutcome | 'idle'>('idle');
  const resultRef = useRef<HTMLDivElement>(null);
  const [destinyCode, setDestinyCode] = useState('');
  const [codeCopyStatus, setCodeCopyStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
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
    setResult(null);
    setConflicts([]);
    setKeywordStrengths([]);
    setSaveStatus('idle');
    setDestinyCode('');
    setShuffledCards(shuffleCards(9));
    setAppStep('picking');
  };

  const handleCardPicked = async (card: TarotResult) => {
    setAppStep('analyzing');
    setLoadingStep(0);

    for (let i = 1; i < LOADING_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 500));
      setLoadingStep(i);
    }
    await new Promise((r) => setTimeout(r, 300));

    const birthdate = `${form.year}-${form.month.padStart(2, '0')}-${form.day.padStart(2, '0')}`;
    const birthtime = SIJU_TIME_MAP[form.birthHour] ?? '';
    const analysisResult = analyzeDestiny(
      birthdate,
      birthtime,
      form.mbti,
      form.gender,
      form.bloodtype,
      card,
    );
    setResult(analysisResult);

    const code = generateDestinyCode(analysisResult);
    setDestinyCode(code);
    const allCoreTags = [...new Set([
      ...analysisResult.saju.coreTags,
      ...analysisResult.zodiac.coreTags,
      ...(analysisResult.mbtiTraits.type ? analysisResult.mbtiTraits.coreTags : []),
      ...analysisResult.bloodType.coreTags,
    ])];
    saveProfile({
      code,
      nickname: form.name || undefined,
      archetype: analysisResult.archetype,
      identityStatement: analysisResult.identityStatement,
      commonKeywords: analysisResult.commonKeywords,
      coreTags: allCoreTags,
      mbti: analysisResult.mbtiTraits.type,
      bloodType: analysisResult.bloodType.type,
      tarotName: analysisResult.tarot.name,
      dayStem: analysisResult.saju.dayStem,
      zodiacSign: analysisResult.zodiac.sign,
      zodiacSignEn: analysisResult.zodiac.signEn,
      dominantElement: analysisResult.saju.dominantElement,
      createdAt: new Date().toISOString(),
    });
    console.log('[page] 생성된 운명 코드:', code, '/ localStorage 확인:', localStorage.getItem('destiny_profiles_v1'));

    setConflicts(detectConflicts(
      analysisResult.saju,
      analysisResult.zodiac,
      analysisResult.mbtiTraits,
      analysisResult.bloodType,
    ));
    setKeywordStrengths(computeKeywordStrengths(
      analysisResult.saju,
      analysisResult.zodiac,
      analysisResult.mbtiTraits,
      analysisResult.bloodType,
    ));
    setAppStep('result');
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleSave = () => {
    if (!result) return;
    saveAnalysis({
      nickname: form.name,
      birthdate: `${form.year}-${form.month.padStart(2, '0')}-${form.day.padStart(2, '0')}`,
      mbti: form.mbti,
      bloodtype: form.bloodtype,
      keywords: result.commonKeywords,
      tarotName: result.tarot.name,
      zodiacSign: result.zodiac.sign,
      resultData: result,
    });
    setSaveStatus('saved');
    setSavedList(getSavedAnalyses());
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const handleShare = async () => {
    if (!result) return;
    const text = generateShareText(result, form.name);
    const outcome = await shareResult(text);
    setShareStatus(outcome);
    if (outcome !== 'failed') setTimeout(() => setShareStatus('idle'), 2500);
  };

  const handleViewSaved = (saved: SavedAnalysis) => {
    setResult(saved.resultData);
    setConflicts([]);
    setKeywordStrengths([]);
    setSaveStatus('idle');
    setShowHistory(false);
    setAppStep('result');
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleDeleteSaved = (id: string) => {
    deleteAnalysis(id);
    setSavedList(getSavedAnalyses());
  };

  const birthdateComputed = form.year && form.month && form.day
    ? `${form.year}-${form.month.padStart(2, '0')}-${form.day.padStart(2, '0')}`
    : '';
  const isFormValid = form.name && birthdateComputed && form.gender && form.bloodtype;

  const inputClass =
    'w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:bg-slate-800/90 transition-colors text-sm [color-scheme:dark]';
  const selectClass =
    'w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/60 focus:bg-slate-800/90 transition-colors text-sm [color-scheme:dark]';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white">
      {/* 타로 카드 선택 화면 (고정 오버레이) */}
      {appStep === 'picking' && (
        <TarotPickerScreen cards={shuffledCards} onPick={handleCardPicked} />
      )}

      {/* 배경 글로우 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-14">
        {/* 헤더 */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs mb-6 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            AI Destiny System
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight bg-gradient-to-r from-purple-300 via-indigo-200 to-purple-400 bg-clip-text text-transparent">
            AI 운명 교집합 분석
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            사주 · 별자리 · MBTI · 혈액형 · 타로의 교집합으로 발견하는
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
                  <select
                    value={form.year}
                    onChange={(e) => setField('year', e.target.value)}
                    className={`${selectClass} ${!form.year ? 'text-slate-500' : ''}`}
                  >
                    <option value="" disabled>년</option>
                    {BIRTH_YEARS.map((y) => (
                      <option key={y} value={String(y)}>{y}년</option>
                    ))}
                  </select>
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

        {/* 분석 기록 */}
        {savedList.length > 0 && (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 mb-6">
            <button
              onClick={() => setShowHistory((h) => !h)}
              className="w-full flex items-center justify-between text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="text-purple-500/70">◆</span>
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

        {/* 로딩 */}
        {appStep === 'analyzing' && <LoadingPanel step={loadingStep} />}

        {/* 결과 */}
        {appStep === 'result' && result && (
          <div ref={resultRef} className="space-y-4">
            {/* 액션 바 */}
            <div className="flex items-center justify-between opacity-0 [animation:fadeInUp_0.4s_ease-out_forwards]">
              <span className="text-purple-400 text-xs tracking-widest uppercase">✦ 분석 결과 ✦</span>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200
                    ${saveStatus === 'saved'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-800/60 border-slate-700/30 text-slate-400 hover:border-purple-500/30 hover:text-purple-300'}`}
                >
                  {saveStatus === 'saved' ? '✓ 저장됨' : '저장하기'}
                </button>
                <button
                  onClick={handleShare}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200
                    ${shareStatus !== 'idle'
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                      : 'bg-slate-800/60 border-slate-700/30 text-slate-400 hover:border-indigo-500/30 hover:text-indigo-300'}`}
                >
                  {shareStatus === 'shared' ? '✓ 공유됨' : shareStatus === 'copied' ? '✓ 텍스트 복사됨' : '공유하기'}
                </button>
              </div>
            </div>

            {/* ── 당신의 본질 헤더 ── */}
            <div className="flex items-center gap-3 pt-2 opacity-0 [animation:fadeInUp_0.4s_ease-out_50ms_forwards]">
              <div className="flex-1 h-px bg-slate-800" />
              <p className="text-slate-600 text-[9px] tracking-[0.5em] uppercase">당신의 본질</p>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* 사주 분석 */}
            <ResultCard icon="☯" title="사주 분석" hoverBorderClass="hover:border-amber-500/30" delay={80}>
              <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                {(['year', 'month', 'day', 'hour'] as const).map((p) => (
                  <div key={p}>
                    <p className="text-[10px] text-slate-600 mb-1">
                      {p === 'year' ? '年' : p === 'month' ? '月' : p === 'day' ? '日' : '時'}
                    </p>
                    <p className="text-base font-semibold text-amber-300 tracking-widest">
                      {result.saju.pillars[p]}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                  일간 {result.saju.dayStemKo}({result.saju.dayStem})
                </span>
                {!result.saju.hasTime && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/30 text-slate-600 text-xs">
                    시간 미입력 · 정오 기준
                  </span>
                )}
              </div>

              <p className="text-slate-400 leading-relaxed text-sm group-hover:text-slate-300 transition-colors duration-300 mb-4">
                {result.saju.description}
              </p>

              <p className="text-xs text-slate-600 mb-2">오행(五行) 비율</p>
              <div className="space-y-2 mb-4">
                {Object.entries(ELEMENT_META).map(([el, meta]) => {
                  const count = result.saju.elements[el as keyof typeof result.saju.elements];
                  const isMissing = count === 0;
                  return (
                    <div key={el} className="flex items-center gap-3">
                      <span className={`text-xs w-12 flex-shrink-0 ${meta.color} ${isMissing ? 'opacity-30' : ''}`}>
                        {meta.label}
                      </span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${meta.bgColor} ${isMissing ? 'opacity-0' : ''} transition-all duration-700`}
                          style={{ width: `${(count / 8) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs w-3 text-right tabular-nums ${isMissing ? 'text-slate-700' : 'text-slate-500'}`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>

              {result.saju.missingElements.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {result.saju.missingElements.map((el) => (
                    <span
                      key={el}
                      className={`px-2.5 py-0.5 rounded-full text-xs border ${ELEMENT_META[el].color} bg-slate-800/60 border-slate-700/50`}
                    >
                      ⚠ {ELEMENT_META[el].label} 부족
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {result.saju.traits.map((trait) => (
                  <span key={trait} className="text-xs text-amber-400/60">
                    #{trait.replace(/\s/g, '')}
                  </span>
                ))}
              </div>
            </ResultCard>

            {/* 별자리 분석 */}
            <ResultCard
              icon={result.zodiac.symbol}
              title="별자리 분석"
              hoverBorderClass="hover:border-blue-500/30"
              delay={180}
            >
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
                  {result.zodiac.sign}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-700/50 border border-slate-600/30 text-slate-400 text-xs">
                  {result.zodiac.element} 원소
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-700/50 border border-slate-600/30 text-slate-400 text-xs">
                  {result.zodiac.rulingPlanet} 지배
                </span>
              </div>
              <p className="text-slate-400 leading-relaxed text-sm group-hover:text-slate-300 transition-colors duration-300">
                {result.zodiac.description}
              </p>
              <div className="flex gap-1.5 mt-3">
                {result.zodiac.coreTags.map((tag) => (
                  <span key={tag} className="text-xs text-blue-400/70">#{tag}</span>
                ))}
              </div>
            </ResultCard>

            {/* MBTI 분석 */}
            {result.mbtiTraits.type ? (
              <ResultCard icon="◈" title="MBTI 분석" hoverBorderClass="hover:border-emerald-500/30" delay={280}>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono font-semibold">
                    {result.mbtiTraits.type}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-700/50 border border-slate-600/30 text-slate-400 text-xs">
                    {result.mbtiTraits.groupLabel} ({result.mbtiTraits.typeGroup})
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed text-sm group-hover:text-slate-300 transition-colors duration-300 mb-3">
                  {result.mbtiTraits.description}
                </p>
                <ul className="space-y-1">
                  {result.mbtiTraits.strengths.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="text-emerald-500/60">▸</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </ResultCard>
            ) : (
              <div
                className="bg-slate-900/40 border border-slate-800/50 rounded-2xl px-5 py-3.5 flex items-center gap-3
                  opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
                style={{ animationDelay: '280ms' }}
              >
                <span className="text-slate-700 text-base">◈</span>
                <p className="text-slate-600 text-xs leading-relaxed">
                  MBTI 미입력 · 사주 · 별자리 · 혈액형 · 타로 4개 체계로 분석이 진행되었습니다
                </p>
              </div>
            )}

            {/* 혈액형 분석 */}
            <ResultCard icon="◈" title="혈액형 분석" hoverBorderClass="hover:border-rose-500/30" delay={380}>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold">
                  {result.bloodType.type}형
                </span>
              </div>
              <p className="text-slate-400 leading-relaxed text-sm group-hover:text-slate-300 transition-colors duration-300 mb-3">
                {result.bloodType.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.bloodType.traits.map((trait) => (
                  <span key={trait} className="text-xs text-rose-400/60">
                    #{trait.replace(/\s/g, '')}
                  </span>
                ))}
              </div>
            </ResultCard>

            {/* 운명 코드 강도 */}
            {keywordStrengths.length > 0 && (
              <div
                className="bg-slate-900/60 backdrop-blur-md border border-amber-500/20 rounded-2xl p-6 shadow-xl
                  opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
                style={{ animationDelay: '530ms' }}
              >
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-1">
                  <span className="text-amber-400 text-lg">◈</span>
                  운명 코드 강도
                </h3>
                <p className="text-slate-600 text-xs mb-4">
                  {result.mbtiTraits.type ? '네' : '세'} 분석 체계에서 각 성향이 얼마나 강하게 수렴되는지 나타냅니다
                </p>
                <div className="space-y-3.5">
                  {keywordStrengths.map((ks) => (
                    <div key={ks.coreTag}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-300 text-xs">{ks.keyword}</span>
                        <span className="text-amber-400 text-xs font-mono font-semibold tabular-nums">{ks.percentage}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700"
                          style={{ width: `${ks.percentage}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0 mt-1">
                        {ks.sources.map((src) => (
                          <span key={src} className="text-[10px] text-amber-400/45">{src}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 내면 갈등 패턴 */}
            {conflicts.length > 0 && (
              <div
                className="bg-slate-900/60 backdrop-blur-md border border-orange-500/20 rounded-2xl p-6 shadow-xl
                  opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
                style={{ animationDelay: '580ms' }}
              >
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-1">
                  <span className="text-orange-400 text-lg">⚡</span>
                  내면 갈등 패턴
                </h3>
                <p className="text-slate-600 text-xs mb-4">
                  여러 체계에서 감지된 충돌 에너지입니다. 인식하는 것 자체가 해방의 시작입니다.
                </p>
                <div className="space-y-4">
                  {conflicts.map((c, i) => (
                    <div
                      key={i}
                      className={i < conflicts.length - 1 ? 'pb-4 border-b border-orange-900/25' : ''}
                    >
                      <p className="text-orange-300/90 text-xs font-semibold mb-1.5">◈ {c.title}</p>
                      <p className="text-slate-400 text-sm leading-relaxed">{c.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI 종합 해석 */}
            <div
              className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-md
                border border-purple-400/25 rounded-2xl p-6
                shadow-xl shadow-purple-950/30
                opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
              style={{ animationDelay: '630ms' }}
            >
              <h3 className="flex items-center gap-2 text-sm font-semibold text-purple-200 mb-6">
                <span className="text-purple-300 text-lg">★</span>
                AI 종합 해석
              </h3>
              <div className="space-y-5">
                {result.detailedReading.sections.map((section, sIdx) => (
                  <div key={section.title}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] font-bold flex items-center justify-center">
                        {sIdx + 1}
                      </span>
                      <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider">
                        {section.title}
                      </p>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-sm ml-8">
                      {section.content}
                    </p>
                    {sIdx < result.detailedReading.sections.length - 1 && (
                      <div className="mt-5 border-b border-purple-900/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── 교집합 강조 섹션 ───────────────────────────────────────────── */}
            <div
              className="relative overflow-hidden rounded-2xl border border-violet-500/40
                opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
              style={{
                animationDelay: '730ms',
                background: 'linear-gradient(135deg, #0d0720 0%, #120a2e 50%, #0a0520 100%)',
              }}
            >
              {/* ambient glow */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-40 bg-violet-600/15 rounded-full blur-3xl" />
                <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl" />
              </div>

              <div className="relative p-8 text-center">
                {/* top eyebrow */}
                <p className="text-amber-400/65 text-[10px] tracking-[0.45em] uppercase mb-7 font-medium">
                  모든 흐름은 결국 하나를 가리키고 있습니다
                </p>

                {/* divider */}
                <div className="flex items-center gap-3 mb-7">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                  <span className="text-violet-400/50 text-[9px] tracking-widest">✦</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                </div>

                {/* identity sentence */}
                <p className="text-white text-xl md:text-2xl font-semibold leading-relaxed mb-8 px-2">
                  {result.identityStatement.split('—').map((part, i) => (
                    <span key={i}>
                      {i > 0 && <><br /><span className="text-violet-400/60">—</span></>}
                      {part}
                    </span>
                  ))}
                </p>

                {/* divider */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent to-violet-500/30" />
                  <span className="text-violet-400/50 text-[9px] tracking-[0.4em] uppercase">교집합</span>
                  <div className="flex-1 h-px bg-gradient-to-l from-transparent to-violet-500/30" />
                </div>

                {/* keywords */}
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {result.commonKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-4 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/35
                        text-violet-100 text-sm font-medium tracking-wide"
                    >
                      {kw}
                    </span>
                  ))}
                </div>

                {/* footnote */}
                <p className="text-slate-600 text-[10px]">
                  {result.mbtiTraits.type ? '5개' : '4개'} 분석 체계에서 독립적으로 반복 확인된 교집합입니다
                </p>
              </div>
            </div>

            {/* ── 최종 정체성 선언 ──────────────────────────────────────────── */}
            <div
              className="relative overflow-hidden rounded-2xl border border-amber-400/30
                opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
              style={{
                animationDelay: '830ms',
                background: 'linear-gradient(135deg, #110800 0%, #0d0700 50%, #080808 100%)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 bg-amber-500/8 rounded-full blur-3xl" />
              </div>
              <div className="relative p-8 text-center">
                <p className="text-amber-400/55 text-[9px] tracking-[0.5em] uppercase mb-5">
                  ✦  당신의 운명 코드  ✦
                </p>
                <p className="text-amber-100 text-3xl font-bold tracking-wide mb-4 [text-shadow:0_0_30px_rgba(245,158,11,0.3)]">
                  {result.archetype}
                </p>
                <p className="text-slate-600 text-xs leading-relaxed">
                  수천 개의 조합 중, 당신의 패턴이 가리키는 정의입니다
                </p>
              </div>
            </div>

            {/* ── DESTINY CODE 카드 ─────────────────────────────────────────── */}
            <div
              className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-xl px-5 py-5
                opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
              style={{ animationDelay: '880ms' }}
            >
              <p className="text-[9px] text-slate-600 tracking-[0.55em] uppercase text-center mb-5">
                DESTINY CODE
              </p>
              <div className={`grid gap-4 ${result.mbtiTraits.type ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {result.mbtiTraits.type && (
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-emerald-300/90 font-mono font-bold text-base tracking-wider">
                      {result.mbtiTraits.type}
                    </span>
                    <span className="text-slate-600 text-[8px] tracking-[0.25em] uppercase leading-none">
                      {MBTI_CODE_LABELS[result.mbtiTraits.type] ?? ''}
                    </span>
                  </div>
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-amber-300/90 font-mono font-bold text-base">
                    {result.saju.dayStem}
                  </span>
                  <span className="text-slate-600 text-[8px] tracking-[0.25em] uppercase leading-none">
                    {DAY_STEM_LABELS[result.saju.dayStem] ?? ''}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-violet-300/90 font-mono font-bold text-base">
                    {result.tarot.nameEn.replace('The ', '')}
                  </span>
                  <span className="text-slate-600 text-[8px] tracking-[0.25em] uppercase leading-none">
                    {result.tarot.nameEn.replace('The ', '').toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-blue-300/90 font-mono font-bold text-base">
                    {result.zodiac.signEn}
                  </span>
                  <span className="text-slate-600 text-[8px] tracking-[0.25em] uppercase leading-none">
                    {ZODIAC_CODE_LABELS[result.zodiac.signEn] ?? ''}
                  </span>
                </div>
              </div>
            </div>

            {/* ── 또 하나의 흐름과 연결하기 ── */}
            {destinyCode && (
              <div
                className="bg-slate-900/60 border border-violet-500/25 rounded-2xl p-5
                  opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
                style={{ animationDelay: '910ms' }}
              >
                <p className="text-slate-600 text-[9px] tracking-[0.45em] uppercase mb-4 text-center">
                  또 하나의 흐름과 연결하기
                </p>
                <div className="text-center mb-5">
                  <p className="text-amber-300 font-mono font-bold text-2xl tracking-widest mb-1">{destinyCode}</p>
                  <p className="text-slate-700 text-[10px]">당신의 운명 코드</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(destinyCode);
                        setCodeCopyStatus('copied');
                        setTimeout(() => setCodeCopyStatus('idle'), 2500);
                      } catch { /* ignore */ }
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200
                      ${codeCopyStatus === 'copied'
                        ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'}`}
                  >
                    {codeCopyStatus === 'copied' ? '✓ 복사됨' : '운명 코드 복사'}
                  </button>
                  <a
                    href="/compatibility"
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-violet-500/30
                      bg-violet-500/10 text-violet-300 hover:bg-violet-500/15 transition-all duration-200
                      text-center"
                  >
                    교집합 궁합 보기
                  </a>
                </div>
              </div>
            )}

            {/* ── 현재 흐름 헤더 ── */}
            <div className="flex items-center gap-3 pt-4 opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]" style={{ animationDelay: '930ms' }}>
              <div className="flex-1 h-px bg-slate-800" />
              <p className="text-slate-600 text-[9px] tracking-[0.5em] uppercase">현재 흐름</p>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* ── 타로 카드 (흐름 섹션) ── */}
            <div
              className="group bg-gradient-to-br from-violet-900/20 to-purple-900/20 backdrop-blur-md
                border border-violet-500/30 rounded-2xl p-6
                shadow-xl hover:shadow-2xl hover:border-violet-400/40
                transition-all duration-300 cursor-default
                opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
              style={{ animationDelay: '980ms' }}
            >
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-4">
                <span className="text-lg">✧</span>
                선택된 타로
                <span className="ml-auto text-[10px] text-violet-400/60 font-normal tracking-wide">현재 흐름을 해석합니다</span>
              </h3>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-20 rounded-xl bg-gradient-to-b from-violet-950 to-[#1a0840] border-2 border-amber-400/50 flex flex-col items-center justify-center gap-1 shadow-lg shadow-violet-950/60 [animation:cardFloat_4s_ease-in-out_infinite]">
                  <span className="text-amber-400/80 text-[9px] font-mono tracking-widest">{result.tarot.romanNumeral}</span>
                  <span className="text-violet-200 text-2xl leading-none">{result.tarot.symbol}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-violet-200 font-semibold text-sm mb-0.5">{result.tarot.name}</p>
                  <p className="text-slate-600 text-xs mb-2">{result.tarot.nameEn}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.tarot.keywords.map((kw) => (
                      <span key={kw} className="px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-300 text-[10px]">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 현재 흐름 해석 카드 ── */}
            <div
              className="bg-slate-900/60 backdrop-blur-md border border-violet-500/20 rounded-2xl p-6 shadow-xl
                opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
              style={{ animationDelay: '1060ms' }}
            >
              <p className="text-violet-200 text-base font-semibold leading-relaxed mb-6">
                {result.tarotFlow.contextualNote}
              </p>
              <div className="space-y-5">
                {result.tarotFlow.currentMood && (
                  <div>
                    <p className="text-slate-600 text-[9px] tracking-[0.4em] uppercase mb-2">지금 에너지</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{result.tarotFlow.currentMood}</p>
                  </div>
                )}
                {result.tarotFlow.currentRelation && (
                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-slate-600 text-[9px] tracking-[0.4em] uppercase mb-2">관계 흐름</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{result.tarotFlow.currentRelation}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── 지금 필요한 태도 ── */}
            {result.tarotFlow.todayAttitude && (
              <div
                className="bg-slate-900/50 border border-indigo-500/20 rounded-2xl p-6
                  opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
                style={{ animationDelay: '1130ms' }}
              >
                <p className="text-indigo-400/70 text-[9px] tracking-[0.45em] uppercase mb-4">지금 필요한 태도</p>
                <p className="text-slate-300 text-sm leading-relaxed">{result.tarotFlow.todayAttitude}</p>
              </div>
            )}

            {/* 다시 분석하기 + 공유 */}
            <div className="flex items-center justify-center gap-3 pt-2 opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]" style={{ animationDelay: '1200ms' }}>
              <button
                onClick={handleShare}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200
                  ${shareStatus !== 'idle'
                    ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                    : 'bg-violet-500/10 border-violet-500/25 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400/40'}`}
              >
                {shareStatus === 'shared' ? '✓ 공유됨' : shareStatus === 'copied' ? '✓ 복사됨' : '결과 공유하기'}
              </button>
              <button
                onClick={() => setAppStep('form')}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-slate-700/40 text-slate-500
                  hover:border-purple-500/30 hover:text-purple-300 transition-all duration-200"
              >
                ↺ 다시 분석하기
              </button>
            </div>
          </div>
        )}

        <footer className="text-center mt-14 text-slate-700 text-xs">
          AI 분석 결과는 참고용이며 실제 운명을 보장하지 않습니다
        </footer>
      </div>
    </div>
  );
}
