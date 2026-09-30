import { PalmRequestGate } from '@/app/lib/server/palmAccess';
import { handlePalmAnalyze } from '@/app/lib/server/palmExtraction';
import {
  createOpenAIPalmVisionProvider,
  PALM_OPENAI_ADAPTER_VERSION,
  PALM_OPENAI_MODEL,
  PALM_VISION_PROMPT_VERSION,
} from '@/app/lib/server/openaiPalmVision';

// Palm Phase 1B: 운영자 전용 손바닥 관찰 추출. 이미지 한 장(raw binary body) → 검증된 PalmObservationBundle.
// 기존 분석·Evidence·저장과 연결되지 않는다.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 40;

const gate = new PalmRequestGate();

export async function POST(req: Request): Promise<Response> {
  return handlePalmAnalyze(req, {
    env: process.env,
    createProvider: (apiKey) => createOpenAIPalmVisionProvider({ apiKey }),
    gate,
    metadata: {
      adapterVersion: PALM_OPENAI_ADAPTER_VERSION,
      modelRevision: PALM_OPENAI_MODEL,
      promptVersion: PALM_VISION_PROMPT_VERSION,
    },
    requestTimeoutMs: 30_000,
    providerTimeoutMs: 20_000,
  });
}
