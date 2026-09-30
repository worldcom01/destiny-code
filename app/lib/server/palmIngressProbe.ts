import 'server-only';
import { createHmac } from 'node:crypto';
import { isOperatorSecretValid, PALM_SECRET_HEADER } from './palmAccess';
import {
  isDocumentationIp,
  palmIngressVerificationToken,
  readPalmDeploymentIdentity,
  PALM_TRUSTED_INGRESS_STRATEGIES,
  trustedClientIp,
  type PalmTrustedIngress,
} from './palmPublicAccess';

// ── Palm Phase 1C: 운영자 전용 비유료 ingress probe (POST /api/palm/ingress-check) ──
// 목적: "공격자가 넣은 IP 헤더를 이 배포의 ingress가 덮어쓰는가"를 공개 OFF 상태에서 확인한다.
// 사용법: 운영자가 x-palm-ingress-probe에 문서화용 가짜 IP(예: 192.0.2.77)를 넣고, 같은 값을 신뢰 헤더와
//        x-forwarded-for / x-real-ip에도 넣어 보낸다. 앱이 받은 신뢰 헤더 값이 유효한 단일 IP이고
//        주입값·문서화 대역이 아니면(= ingress가 덮어씀) 검증 토큰을 준다. 아니면 not-established.
// provider·DB를 호출하지 않는다. PALM_PUBLIC_ENABLED·PALM_EXTRACTION_ENABLED가 false여도 동작하며,
// 공개 기능을 켜지 않는다(토큰은 env에 적용해야만 의미가 있다). 원래 IP는 응답·로그에 남기지 않고
// 짧은 HMAC fingerprint만 준다(같은 배포·같은 UTC 날짜에서 대조·위조값 비교용, 저장하지 않음).
// 토큰은 이 배포의 식별값(환경·프로젝트·커밋·ingress 세대)에 묶인다 — 다른 배포에서는 무효.

export const PALM_INGRESS_PROBE_HEADER = 'x-palm-ingress-probe';

type ProbeResult =
  | {
      ingress: 'established';
      strategy: PalmTrustedIngress;
      deployment: { environment: string; commit: string }; // 운영자가 올바른 배포를 검사했는지 확인하는 용도
      ipFingerprint: string;
      verificationToken: string;
    }
  | { ingress: 'not-established'; reason: string };

function reply(status: number, body: ProbeResult | { error: string }): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function handlePalmIngressCheck(req: Request, deps: { env: Record<string, string | undefined> }): Promise<Response> {
  const env = deps.env;
  if (!isOperatorSecretValid(req.headers.get(PALM_SECRET_HEADER), env.PALM_EXTRACTION_SECRET ?? '')) return reply(401, { error: 'ACCESS_DENIED' });

  const strategy = (env.PALM_TRUSTED_INGRESS ?? '').trim();
  if (!Object.prototype.hasOwnProperty.call(PALM_TRUSTED_INGRESS_STRATEGIES, strategy)) return reply(200, { ingress: 'not-established', reason: 'strategy-unsupported' });
  const secret = env.PALM_SESSION_SECRET ?? '';
  const origin = env.PALM_PUBLIC_ORIGIN ?? '';
  if (secret.length < 32 || !origin) return reply(200, { ingress: 'not-established', reason: 'secret-or-origin-invalid' });
  const deployment = readPalmDeploymentIdentity(env);
  if (!deployment.ok) return reply(200, { ingress: 'not-established', reason: `deployment-identity:${deployment.reason}` });

  const marker = (req.headers.get(PALM_INGRESS_PROBE_HEADER) ?? '').trim();
  if (!isDocumentationIp(marker)) return reply(400, { error: 'PROBE_MARKER_REQUIRED' });

  const header = PALM_TRUSTED_INGRESS_STRATEGIES[strategy as PalmTrustedIngress].header;
  const raw = req.headers.get(header);
  if (raw === null) return reply(200, { ingress: 'not-established', reason: 'trusted-header-missing' });
  const ip = trustedClientIp(req, header);
  if (!ip) return reply(200, { ingress: 'not-established', reason: 'trusted-header-invalid-or-multiple' });
  if (ip === marker || isDocumentationIp(ip)) return reply(200, { ingress: 'not-established', reason: 'spoofed-value-passed-through' });

  // fingerprint는 배포·UTC 날짜 단위로 바뀐다 → 대조 요청은 같은 배포·같은 UTC 날짜에서 비교한다
  const day = new Date().toISOString().slice(0, 10);
  const ipFingerprint = createHmac('sha256', secret).update(`palm-ingress-probe-v2|${deployment.bindingKey}|${day}|${ip}`).digest('base64url').slice(0, 12);
  return reply(200, {
    ingress: 'established',
    strategy: strategy as PalmTrustedIngress,
    deployment: { environment: deployment.identity.environment, commit: deployment.identity.commitSha.slice(0, 7) },
    ipFingerprint,
    verificationToken: palmIngressVerificationToken(secret, strategy as PalmTrustedIngress, origin, deployment.bindingKey),
  });
}
