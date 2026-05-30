'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { analyzeCompatibility, type CompatibilityResult } from '@/app/lib/compatibilityEngine';
import { getProfileByCode, loadAllProfiles, shareStringToProfile, type DestinyProfile } from '@/app/lib/profileStore';
import { isShareString } from '@/app/lib/destinyCode';
import type { CoreTag } from '@/app/lib/analysis';

const TAG_LABELS: Partial<Record<CoreTag, string>> = {
  창의적: '창의적 사고',
  분석적: '분석적 사고',
  감성적: '감성적 공감',
  실용적: '실용적 실행',
  사교적: '뛰어난 사교성',
  독립적: '강한 독립심',
  직관적: '예리한 직관력',
  체계적: '체계적 사고',
  열정적: '넘치는 열정',
  포용적: '따뜻한 포용력',
};

function resolveProfile(input: string): DestinyProfile | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isShareString(trimmed)) return shareStringToProfile(trimmed);
  return getProfileByCode(trimmed);
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-slate-800" />
      <p className="text-slate-600 text-[9px] tracking-[0.45em] uppercase">{label}</p>
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  );
}

function ProfileChip({
  profile,
  selected,
  accent,
  onClick,
}: {
  profile: DestinyProfile;
  selected: boolean;
  accent: 'amber' | 'violet';
  onClick: () => void;
}) {
  const activeClasses =
    accent === 'amber'
      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-sm shadow-amber-500/20'
      : 'bg-violet-500/20 border-violet-500/50 text-violet-200 shadow-sm shadow-violet-500/20';
  const hoverClasses =
    accent === 'amber'
      ? 'hover:border-amber-500/30 hover:text-amber-300'
      : 'hover:border-violet-500/30 hover:text-violet-300';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 text-left
        ${selected
          ? activeClasses
          : `bg-slate-800/60 border-slate-700/30 text-slate-400 ${hoverClasses}`}`}
    >
      <div className="min-w-0">
        <p className={`font-mono font-bold text-xs tracking-wider leading-none mb-0.5
          ${selected ? (accent === 'amber' ? 'text-amber-200' : 'text-violet-200') : 'text-slate-300'}`}>
          {profile.code}
        </p>
        {profile.nickname && (
          <p className="text-[10px] text-slate-600 truncate leading-none">{profile.nickname}</p>
        )}
      </div>
      {selected && (
        <span className={`ml-1 text-[9px] flex-shrink-0 ${accent === 'amber' ? 'text-amber-400' : 'text-violet-400'}`}>
          ✓
        </span>
      )}
    </button>
  );
}

export default function CompatibilityPage() {
  const [codeA, setCodeA] = useState('');
  const [codeB, setCodeB] = useState('');
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [profileA, setProfileA] = useState<DestinyProfile | null>(null);
  const [profileB, setProfileB] = useState<DestinyProfile | null>(null);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [savedProfiles, setSavedProfiles] = useState<DestinyProfile[]>([]);

  useEffect(() => {
    const profiles = loadAllProfiles();
    setSavedProfiles(profiles);
    if (profiles.length > 0) {
      setCodeA(profiles[0].code);
    }
  }, []);

  const selectedProfileA = savedProfiles.find(p => p.code === codeA.trim()) ?? null;
  const selectedProfileB = savedProfiles.find(p => p.code === codeB.trim()) ?? null;
  const profilesForB = savedProfiles.filter(p => p.code !== codeA.trim());

  function handleAnalyze() {
    setError('');
    const pA = resolveProfile(codeA);
    const pB = resolveProfile(codeB);

    if (!pA && !pB) {
      setError('두 코드 모두 찾을 수 없습니다. 이 기기에서 분석을 완료한 코드를 선택하거나 입력해주세요.');
      return;
    }
    if (!pA) {
      setError(`"${codeA.trim()}" 코드를 찾을 수 없습니다. 같은 기기에서 분석한 코드를 선택해주세요.`);
      return;
    }
    if (!pB) {
      setError(`"${codeB.trim()}" 코드를 찾을 수 없습니다. 같은 기기에서 분석한 코드를 선택해주세요.`);
      return;
    }
    if (pA.code === pB.code) {
      setError('같은 코드가 선택되었습니다. 서로 다른 두 사람의 코드를 선택해주세요.');
      return;
    }

    setProfileA(pA);
    setProfileB(pB);
    setResult(analyzeCompatibility(pA, pB));
  }

  function handleReset() {
    setResult(null);
    setProfileA(null);
    setProfileB(null);
    setError('');
    setCodeB('');
  }

  async function handleCopyResult() {
    if (!result || !profileA || !profileB) return;
    const text = `✦ 운명 교차 분석\n\n${profileA.code} × ${profileB.code}\n\n[관계 교집합]\n${result.relationLabel}\n\n[관계 서사]\n${result.relationNarrative}\n\n[관계 Archetype]\n${result.relationArchetype}\n\n→ AI 운명 교차 분석으로 두 사람의 교집합을 확인해보세요`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2500);
    } catch { /* ignore */ }
  }

  const canAnalyze = codeA.trim().length > 0 && codeB.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#060612] text-slate-100">
      <div className="max-w-md mx-auto px-4 py-10 pb-20">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-amber-400/60 text-[9px] tracking-[0.5em] uppercase mb-3">✦ 운명 교차 분석 ✦</p>
          <h1 className="text-xl font-bold text-slate-100 mb-2">두 운명의 교차</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            두 사람의 운명 코드를 선택하면<br />서로의 교집합을 분석합니다
          </p>
        </div>

        {!result ? (
          /* ── 입력 화면 ── */
          <div className="space-y-4">

            {/* 최근 생성한 운명 코드 */}
            {savedProfiles.length > 0 && (
              <div className="bg-slate-900/50 border border-amber-500/20 rounded-2xl p-4">
                <p className="text-amber-400/50 text-[9px] tracking-[0.45em] uppercase mb-3">최근 생성한 운명 코드</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-amber-300 font-mono font-bold text-xl tracking-widest leading-none mb-1">
                      {savedProfiles[0].code}
                    </p>
                    {savedProfiles[0].nickname && (
                      <p className="text-slate-500 text-xs truncate">{savedProfiles[0].nickname}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setCodeA(savedProfiles[0].code)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium border transition-all duration-200
                      ${codeA === savedProfiles[0].code
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800/60 border-amber-500/25 text-amber-400/80 hover:bg-amber-500/15 hover:border-amber-500/40'}`}
                  >
                    {codeA === savedProfiles[0].code ? '✓ 선택됨' : '내 코드로 사용'}
                  </button>
                </div>
              </div>
            )}

            {/* 첫 번째 코드 */}
            <div className={`bg-slate-900/60 border rounded-2xl p-5 transition-all duration-300
              ${selectedProfileA ? 'border-amber-500/40 shadow-lg shadow-amber-500/5' : 'border-slate-700/40'}`}>
              <p className="text-slate-500 text-[9px] tracking-[0.4em] uppercase mb-3">첫 번째 코드</p>

              {savedProfiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {savedProfiles.map(p => (
                    <ProfileChip
                      key={p.code}
                      profile={p}
                      selected={codeA === p.code}
                      accent="amber"
                      onClick={() => setCodeA(p.code)}
                    />
                  ))}
                </div>
              )}

              <input
                type="text"
                value={codeA}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCodeA(e.target.value)}
                placeholder={savedProfiles.length > 0 ? '또는 공유 코드 직접 입력...' : '예: DX-4932'}
                className="w-full bg-slate-800/60 border border-slate-700/30 rounded-xl px-4 py-3
                  text-slate-100 placeholder-slate-600 text-sm font-mono tracking-wider
                  focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
              />
            </div>

            {/* × 구분자 */}
            <div className="flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-slate-800/60 border border-slate-700/30 flex items-center justify-center">
                <span className="text-slate-500 text-xs">×</span>
              </div>
            </div>

            {/* 두 번째 코드 */}
            <div className={`bg-slate-900/60 border rounded-2xl p-5 transition-all duration-300
              ${selectedProfileB ? 'border-violet-500/40 shadow-lg shadow-violet-500/5' : 'border-slate-700/40'}`}>
              <p className="text-slate-500 text-[9px] tracking-[0.4em] uppercase mb-3">두 번째 코드</p>

              {profilesForB.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {profilesForB.map(p => (
                    <ProfileChip
                      key={p.code}
                      profile={p}
                      selected={codeB === p.code}
                      accent="violet"
                      onClick={() => setCodeB(p.code)}
                    />
                  ))}
                </div>
              )}

              {profilesForB.length === 0 && savedProfiles.length > 0 && (
                <p className="text-slate-700 text-xs mb-3 leading-relaxed">
                  이 기기에 다른 코드가 없습니다.<br />상대방의 공유 코드를 입력해주세요.
                </p>
              )}

              <input
                type="text"
                value={codeB}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCodeB(e.target.value)}
                placeholder="상대방 코드 또는 공유 코드 입력..."
                className="w-full bg-slate-800/60 border border-slate-700/30 rounded-xl px-4 py-3
                  text-slate-100 placeholder-slate-600 text-sm font-mono tracking-wider
                  focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
              />
            </div>

            {error && (
              <p className="text-rose-400/80 text-xs text-center leading-relaxed px-2">{error}</p>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="w-full py-3.5 rounded-xl font-semibold text-sm
                bg-gradient-to-r from-violet-600/80 to-purple-600/80 border border-violet-500/40
                text-violet-100 hover:from-violet-500/80 hover:to-purple-500/80
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-all duration-200"
            >
              두 흐름 연결하기
            </button>

            {savedProfiles.length === 0 && (
              <p className="text-slate-700 text-[10px] text-center leading-relaxed">
                운명 분석을 먼저 완료하면 코드가 자동으로 저장됩니다
              </p>
            )}

            <a
              href="/"
              className="block text-center text-slate-600 text-xs hover:text-slate-400 transition-colors"
            >
              ← 분석 시작하기
            </a>
          </div>
        ) : (
          /* ── 결과 화면 ── */
          <div className="space-y-4">

            {/* 코드 헤더 */}
            <div className="text-center py-4">
              <p className="text-slate-600 text-[9px] tracking-[0.4em] uppercase mb-3">운명 교차</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-amber-300 font-mono font-bold text-lg tracking-wider">{profileA!.code}</span>
                <span className="text-slate-600 text-base">×</span>
                <span className="text-violet-300 font-mono font-bold text-lg tracking-wider">{profileB!.code}</span>
              </div>
              {(profileA!.nickname || profileB!.nickname) && (
                <p className="text-slate-600 text-xs mt-2">
                  {profileA!.nickname || '—'} · {profileB!.nickname || '—'}
                </p>
              )}
            </div>

            <SectionDivider label="두 사람의 흐름" />

            {/* 두 사람의 흐름 */}
            <div className="bg-slate-900/60 border border-slate-700/40 rounded-2xl p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-amber-300/80 font-mono text-xs font-bold">{profileA!.code}</span>
                  {profileA!.nickname && <span className="text-slate-600 text-xs">· {profileA!.nickname}</span>}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{result.personAFlow}</p>
              </div>
              <div className="border-t border-slate-800" />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-violet-300/80 font-mono text-xs font-bold">{profileB!.code}</span>
                  {profileB!.nickname && <span className="text-slate-600 text-xs">· {profileB!.nickname}</span>}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{result.personBFlow}</p>
              </div>
            </div>

            <SectionDivider label="관계 교집합" />

            {/* 관계 교집합 */}
            <div
              className="relative overflow-hidden rounded-2xl border border-violet-500/40"
              style={{ background: 'linear-gradient(135deg, #0d0720 0%, #120a2e 50%, #0a0520 100%)' }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-36 bg-violet-600/15 rounded-full blur-3xl" />
              </div>
              <div className="relative p-8 text-center">
                <p className="text-amber-400/65 text-[10px] tracking-[0.45em] uppercase mb-6">
                  두 운명이 만나는 지점
                </p>
                <p className="text-white text-xl md:text-2xl font-semibold leading-relaxed mb-6">
                  {result.relationLabel}
                </p>

                {result.sharedTags.length > 0 ? (
                  <>
                    <div className="flex flex-wrap justify-center gap-2 mb-5">
                      {result.sharedTags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded-full bg-violet-500/20 border border-violet-400/35
                            text-violet-100 text-xs font-medium tracking-wide"
                        >
                          {TAG_LABELS[tag] ?? tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-slate-600 text-[10px]">
                      두 사람 모두에서 독립적으로 확인된 교집합입니다
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 text-xs leading-relaxed">
                    두 사람의 성향은 서로 다른 방향을 가리키고 있습니다.<br />
                    이 차이가 상호 보완이 될 수도, 조율이 필요한 긴장이 될 수도 있습니다.
                  </p>
                )}
              </div>
            </div>

            <SectionDivider label="관계 서사" />

            <div className="bg-slate-900/60 border border-slate-700/40 rounded-2xl p-5">
              <p className="text-slate-300 text-sm leading-relaxed">{result.relationNarrative}</p>
            </div>

            <SectionDivider label="관계 위험요소" />

            <div className="bg-slate-900/60 border border-orange-500/20 rounded-2xl p-5">
              <p className="text-orange-400/70 text-[9px] tracking-[0.4em] uppercase mb-3">⚠ 주의해야 할 흐름</p>
              <p className="text-slate-300 text-sm leading-relaxed">{result.riskFactor}</p>
            </div>

            <SectionDivider label="관계 Archetype" />

            <div
              className="relative overflow-hidden rounded-2xl border border-amber-400/30"
              style={{ background: 'linear-gradient(135deg, #110800 0%, #0d0700 50%, #080808 100%)' }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-28 bg-amber-500/8 rounded-full blur-3xl" />
              </div>
              <div className="relative p-7 text-center">
                <p className="text-amber-400/55 text-[9px] tracking-[0.5em] uppercase mb-4">
                  ✦  두 운명의 교차 정의  ✦
                </p>
                <p className="text-amber-100 text-2xl font-bold tracking-wide mb-3 [text-shadow:0_0_30px_rgba(245,158,11,0.3)]">
                  {result.relationArchetype}
                </p>
                <p className="text-slate-600 text-xs">
                  두 운명 코드가 교차할 때 만들어지는 관계의 본질
                </p>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleCopyResult}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200
                  ${copyStatus === 'copied'
                    ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                    : 'bg-violet-500/10 border-violet-500/25 text-violet-400 hover:bg-violet-500/20'}`}
              >
                {copyStatus === 'copied' ? '✓ 복사됨' : '결과 복사하기'}
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-slate-700/40 text-slate-500
                  hover:border-violet-500/30 hover:text-violet-300 transition-all duration-200"
              >
                ↺ 다시 분석하기
              </button>
            </div>

            <a
              href="/"
              className="block text-center text-slate-600 text-xs hover:text-slate-400 transition-colors pt-1"
            >
              ← 내 분석으로 돌아가기
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
