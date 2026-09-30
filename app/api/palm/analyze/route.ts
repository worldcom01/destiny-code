import { PalmRequestGate, PALM_SECRET_HEADER } from '@/app/lib/server/palmAccess';
import { handlePalmAnalyze } from '@/app/lib/server/palmExtraction';
import { readPalmPublicConfig } from '@/app/lib/server/palmPublicAccess';
import { handlePalmPublicAnalyze } from '@/app/lib/server/palmPublicAnalyze';
import { createPalmProvider, createPalmStore, palmExtractionMetadata } from '@/app/lib/server/palmRouteDeps';

// 손바닥 관찰 추출. 이미지 한 장(raw binary body) → 검증된 PalmObservationBundle.
// - operator 분기 (Phase 1B): x-palm-extraction-secret 헤더가 있는 요청. secret은 서버 전용.
// - 공개 분기 (Phase 1C): 익명 서명 세션 + same-origin + CSRF + 공유 DB 한도. PALM_PUBLIC_ENABLED=false가 기본.
// 기존 분석·Evidence·저장과 연결되지 않는다. 해석은 브라우저의 결정적 규칙이 만든다.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 40;

const gate = new PalmRequestGate();

export async function POST(req: Request): Promise<Response> {
  if (req.headers.has(PALM_SECRET_HEADER)) {
    const pub = readPalmPublicConfig(process.env);
    let globalBudget;
    try {
      globalBudget = pub.enabled ? { store: await createPalmStore(pub), limits: pub.limits } : undefined;
    } catch {
      // 공개 예산 저장소를 쓸 수 없으면 운영자 호출도 전역 상한을 우회하지 않도록 닫는다
      return Response.json({ ok: false, error: { code: 'UNAVAILABLE' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return handlePalmAnalyze(req, {
      env: process.env,
      createProvider: createPalmProvider,
      gate,
      metadata: palmExtractionMetadata,
      requestTimeoutMs: 30_000,
      providerTimeoutMs: 20_000,
      globalBudget,
    });
  }
  return handlePalmPublicAnalyze(req, {
    env: process.env,
    createProvider: createPalmProvider,
    createStore: createPalmStore,
    metadata: palmExtractionMetadata,
    requestTimeoutMs: 30_000,
    providerTimeoutMs: 20_000,
  });
}
