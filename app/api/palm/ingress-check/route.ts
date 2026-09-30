import { handlePalmIngressCheck } from '@/app/lib/server/palmIngressProbe';

// Palm Phase 1C: 운영자 전용 비유료 신뢰 ingress 확인. provider·DB 호출 없음. 공개 OFF 상태에서 사용한다.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return handlePalmIngressCheck(req, { env: process.env });
}
