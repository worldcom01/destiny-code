'use client';

import { useState, useEffect, useCallback } from 'react';

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface DistItem  { label: string; count: number }
interface AnalyticsData {
  stats: { total: number; today: number; week7: number };
  distributions: {
    archetypes: DistItem[];
    keywords:   DistItem[];
    mbti:       DistItem[];
    blood:      DistItem[];
    zodiac:     DistItem[];
  };
  bias: { pct: number; label: string; warn: boolean };
  notice?: string;
  rows: Array<{
    id: string;
    created_at: string;
    destiny_code: string;
    archetype: string;
    intersection_keywords: string[];
    mbti: string;
    blood_type: string;
    zodiac: string;
    sun_sign?: string;
    summary_sentence: string;
  }>;
}

// ── 미니 바차트 ───────────────────────────────────────────────────────────────

function BarChart({ items, total, accent = 'violet' }: {
  items: DistItem[];
  total: number;
  accent?: 'violet' | 'amber' | 'blue' | 'rose' | 'emerald';
}) {
  const max   = Math.max(...items.map((i) => i.count), 1);
  const colors: Record<string, string> = {
    violet:  'bg-violet-500',
    amber:   'bg-amber-400',
    blue:    'bg-blue-500',
    rose:    'bg-rose-500',
    emerald: 'bg-emerald-500',
  };
  const bar = colors[accent] ?? colors.violet;

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return (
          <div key={item.label}>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-slate-300 text-xs truncate max-w-[60%]">{item.label || '미입력'}</span>
              <span className="text-slate-500 text-xs tabular-nums">{item.count}건 ({pct}%)</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${bar} rounded-full transition-all duration-500`}
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 통계 카드 ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-2xl p-5 text-center">
      <p className="text-slate-600 text-[10px] tracking-[0.35em] uppercase mb-2">{label}</p>
      <p className="text-amber-300 font-mono font-bold text-3xl">{value.toLocaleString()}</p>
      {sub && <p className="text-slate-700 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}

// ── 섹션 카드 ─────────────────────────────────────────────────────────────────

function SectionCard({ title, children, className = '' }: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-slate-900/60 border border-slate-700/40 rounded-2xl p-5 ${className}`}>
      <h3 className="text-xs font-semibold text-slate-400 tracking-[0.3em] uppercase mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [secret,    setSecret]    = useState('');
  const [authed,    setAuthed]    = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [data,      setData]      = useState<AnalyticsData | null>(null);
  const [search,    setSearch]    = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 검색 디바운스
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async (s: string, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (q) params.set('search', q);
      const res = await fetch(`/api/admin/analytics?${params}`, {
        headers: { 'x-admin-secret': s },
      });
      if (res.status === 401) { setAuthError('비밀번호가 올바르지 않습니다'); setAuthed(false); return; }
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
      setAuthed(true);
      setAuthError('');
    } catch (e) {
      setAuthError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // 인증 후 검색어 변경 시 재조회
  useEffect(() => {
    if (authed) fetchData(secret, debouncedSearch);
  }, [debouncedSearch, authed, fetchData, secret]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(secret, '');
  };

  const handleRefresh = () => fetchData(secret, debouncedSearch);

  // ── 로그인 화면 ─────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-amber-400/60 text-[10px] tracking-[0.45em] uppercase mb-2">DESTINY CODE LAB</p>
            <h1 className="text-xl font-bold text-white">관리자 대시보드</h1>
            <p className="text-slate-600 text-xs mt-1">베타 분석 수집 시스템</p>
          </div>
          <form
            onSubmit={handleLogin}
            className="bg-slate-900/70 border border-purple-500/20 rounded-2xl p-6 space-y-4"
          >
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="관리자 비밀번호"
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500/60 [color-scheme:dark]"
              autoFocus
            />
            {authError && (
              <p className="text-red-400/80 text-xs">{authError}</p>
            )}
            <button
              type="submit"
              disabled={!secret || loading}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:from-purple-500 hover:to-indigo-500 transition-all"
            >
              {loading ? '확인 중...' : '접속'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── 대시보드 ────────────────────────────────────────────────────────────────

  const d = data;
  const total = d?.stats.total ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-amber-400/60 text-[9px] tracking-[0.45em] uppercase mb-1">DESTINY CODE LAB</p>
            <h1 className="text-xl font-bold">관리자 대시보드</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-slate-600 text-xs">베타 분석 수집</p>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600/60 transition-colors disabled:opacity-40"
            >
              {loading ? '로딩...' : '↺ 새로고침'}
            </button>
            <button
              onClick={() => { setAuthed(false); setData(null); setSecret(''); }}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-700/40 text-slate-600 hover:text-red-400 hover:border-red-500/20 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Supabase 미설정 안내 */}
        {d?.notice && (
          <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-600/30 rounded-xl px-4 py-3">
            <span className="text-slate-400 text-lg flex-shrink-0">ℹ</span>
            <p className="text-slate-400 text-sm">{d.notice}</p>
          </div>
        )}

        {/* 편향 경고 */}
        {d?.bias.warn && (
          <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
            <span className="text-orange-400 text-lg flex-shrink-0">⚠</span>
            <div>
              <p className="text-orange-300 text-sm font-semibold">결과 편향 가능성 있음</p>
              <p className="text-orange-400/70 text-xs mt-0.5">
                "{d.bias.label}" 아키타입이 전체의 {d.bias.pct}%를 차지합니다. (기준: 25%)
              </p>
            </div>
          </div>
        )}

        {/* 통계 카드 */}
        {d && (
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="총 분석 수" value={d.stats.total} sub="누적" />
            <StatCard label="오늘" value={d.stats.today} sub="00:00 이후" />
            <StatCard label="최근 7일" value={d.stats.week7} />
          </div>
        )}

        {/* 결과 다양성 분석 */}
        {d && d.distributions.archetypes.length > 0 && (
          <SectionCard title="결과 다양성 분석">
            <p className="text-slate-600 text-xs mb-4">
              전체 {total}건 중 아키타입 분포 — 편향이 없다면 고르게 분산됩니다
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {d.distributions.archetypes.map((item) => {
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                const isBias = pct >= 25;
                return (
                  <div key={item.label} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${isBias ? 'border-orange-500/30 bg-orange-500/5' : 'border-slate-700/30 bg-slate-800/40'}`}>
                    <span className={`text-sm font-medium ${isBias ? 'text-orange-300' : 'text-slate-300'}`}>
                      {item.label}
                    </span>
                    <div className="text-right ml-3 flex-shrink-0">
                      <span className={`font-mono font-bold text-sm ${isBias ? 'text-orange-400' : 'text-amber-400/80'}`}>
                        {pct}%
                      </span>
                      <span className="text-slate-600 text-xs ml-1">({item.count})</span>
                      {isBias && <span className="ml-1.5 text-[9px] text-orange-400/80 border border-orange-500/30 rounded px-1">편향</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* 분포 차트 그리드 */}
        {d && (
          <div className="grid sm:grid-cols-2 gap-4">
            <SectionCard title="TOP 10 교집합 키워드">
              <BarChart items={d.distributions.keywords} total={total} accent="amber" />
            </SectionCard>
            <SectionCard title="별자리(태양궁) 분포">
              <BarChart items={d.distributions.zodiac} total={total} accent="blue" />
            </SectionCard>
            <SectionCard title="MBTI 분포">
              <BarChart items={d.distributions.mbti} total={total} accent="violet" />
            </SectionCard>
            <SectionCard title="혈액형 분포">
              <BarChart items={d.distributions.blood} total={total} accent="rose" />
            </SectionCard>
          </div>
        )}

        {/* 검색 + 목록 */}
        <SectionCard title={`최근 분석 결과 (최대 100건)`}>
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="운명코드 또는 최종 정의로 검색..."
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500/60 [color-scheme:dark]"
            />
          </div>

          {loading && (
            <p className="text-slate-600 text-sm text-center py-8">데이터 로딩 중...</p>
          )}

          {!loading && d && d.rows.length === 0 && (
            <p className="text-slate-700 text-sm text-center py-8">결과가 없습니다</p>
          )}

          {!loading && d && d.rows.length > 0 && (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left text-slate-600 font-medium pb-2 pr-4 whitespace-nowrap">날짜</th>
                    <th className="text-left text-slate-600 font-medium pb-2 pr-4 whitespace-nowrap">운명코드</th>
                    <th className="text-left text-slate-600 font-medium pb-2 pr-4">최종 정의</th>
                    <th className="text-left text-slate-600 font-medium pb-2 pr-4 whitespace-nowrap">별자리</th>
                    <th className="text-left text-slate-600 font-medium pb-2 pr-4">MBTI</th>
                    <th className="text-left text-slate-600 font-medium pb-2">교집합 키워드</th>
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="font-mono font-bold text-amber-300/90 tracking-wider">
                          {row.destiny_code}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-300 max-w-[180px]">
                        <span className="line-clamp-2">{row.archetype}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap">
                        {row.sun_sign ?? row.zodiac}
                      </td>
                      <td className="py-2.5 pr-4">
                        {row.mbti ? (
                          <span className="font-mono text-emerald-400/80">{row.mbti}</span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(row.intersection_keywords ?? []).map((kw) => (
                            <span
                              key={kw}
                              className="px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-300 text-[10px]"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <p className="text-center text-slate-800 text-[10px] pb-4">
          관리자 전용 · Destiny Code Lab Beta
        </p>
      </div>
    </div>
  );
}
