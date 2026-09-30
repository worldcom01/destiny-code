import { handlePalmEvent } from '@/app/lib/server/palmPublicSession';
import { createPalmStore } from '@/app/lib/server/palmRouteDeps';

// Palm Phase 1C: 허용 목록 이벤트만 (palm_prompt_viewed / palm_started / palm_retry). 실패는 UI를 막지 않는다.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return handlePalmEvent(req, { env: process.env, createStore: createPalmStore });
}
