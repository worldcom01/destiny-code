import { handlePalmSession } from '@/app/lib/server/palmPublicSession';
import { createPalmStore } from '@/app/lib/server/palmRouteDeps';

// Palm Phase 1C: 익명 비용 통제 세션 발급 (HttpOnly __Host- cookie + session-bound CSRF token).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return handlePalmSession(req, { env: process.env, createStore: createPalmStore });
}
