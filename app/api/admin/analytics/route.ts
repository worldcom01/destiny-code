import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(req: NextRequest) {
  // 인증 확인
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get('x-admin-secret') !== secret) {
    return unauthorized();
  }

  const client = getServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const limit  = Math.min(Number(url.searchParams.get('limit') ?? '100'), 200);

  // ── 통계 ───────────────────────────────────────────────────────────────────

  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const week7Start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, todayRes, weekRes, listRes] = await Promise.all([
    client.from('analysis_results').select('id', { count: 'exact', head: true }),
    client.from('analysis_results').select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart),
    client.from('analysis_results').select('id', { count: 'exact', head: true })
      .gte('created_at', week7Start),
    (() => {
      let q = client
        .from('analysis_results')
        .select('id,created_at,destiny_code,archetype,intersection_keywords,mbti,blood_type,zodiac,sun_sign,moon_sign,ascendant_sign,summary_sentence')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (search) {
        q = q.or(`destiny_code.ilike.%${search}%,archetype.ilike.%${search}%`);
      }
      return q;
    })(),
  ]);

  // ── 분포 계산용 전체 데이터 (archetypes / keywords / mbti / blood / zodiac) ──
  const { data: allRows } = await client
    .from('analysis_results')
    .select('archetype,intersection_keywords,mbti,blood_type,zodiac,sun_sign');

  function topN<T extends string>(items: T[], n: number): { label: T; count: number }[] {
    const map = new Map<T, number>();
    items.forEach((v) => { if (v) map.set(v, (map.get(v) ?? 0) + 1); });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([label, count]) => ({ label, count }));
  }

  const archetypes   = (allRows ?? []).map((r) => r.archetype as string);
  const allKeywords  = (allRows ?? []).flatMap((r) => (r.intersection_keywords as string[]) ?? []);
  const mbtis        = (allRows ?? []).map((r) => r.mbti as string).filter(Boolean);
  const bloods       = (allRows ?? []).map((r) => r.blood_type as string).filter(Boolean);
  const zodiacs      = (allRows ?? []).map((r) => (r.sun_sign ?? r.zodiac) as string).filter(Boolean);

  const total = totalRes.count ?? 0;

  // 편향 경고: 가장 많은 archetype이 25% 이상이면
  const topArchetype = topN(archetypes, 1)[0];
  const biasPct = total > 0 && topArchetype
    ? Math.round((topArchetype.count / total) * 100)
    : 0;

  return NextResponse.json({
    stats: {
      total,
      today:  todayRes.count ?? 0,
      week7:  weekRes.count ?? 0,
    },
    distributions: {
      archetypes:  topN(archetypes, 10),
      keywords:    topN(allKeywords, 10),
      mbti:        topN(mbtis, 16),
      blood:       topN(bloods, 4),
      zodiac:      topN(zodiacs, 12),
    },
    bias: {
      pct:    biasPct,
      label:  topArchetype?.label ?? '',
      warn:   biasPct >= 25,
    },
    rows: listRes.data ?? [],
  });
}
