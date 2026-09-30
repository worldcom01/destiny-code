// Palm Phase 1C Stage 2 regression: public browser access, shared cost control, storage safety.
//
//   npx -y tsx --conditions=react-server scripts/regression-palm-public.ts
//
// Uses the REAL migration (supabase/palm-public.sql) in a disposable in-process Postgres (PGlite)
// and fake providers. No network, no OpenAI. Two independent server "instances" (separate store +
// handler objects) share the same database. Limitation: PGlite runs statements on one connection,
// so "concurrent" requests are interleaved by the event loop rather than truly parallel sessions.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { handlePalmAnalyze } from '../app/lib/server/palmExtraction';
import { PalmRequestGate } from '../app/lib/server/palmAccess';
import {
  createPalmSession, palmCsrfToken, readPalmPublicConfig, PALM_SESSION_COOKIE,
} from '../app/lib/server/palmPublicAccess';
import { handlePalmPublicAnalyze, type PalmPublicAnalyzeDeps } from '../app/lib/server/palmPublicAnalyze';
import { handlePalmEvent, handlePalmSession } from '../app/lib/server/palmPublicSession';
import { createPalmPublicStore, PalmGateUnavailable, type PalmPublicStore, type PalmRpc } from '../app/lib/server/palmPublicGate';
import type { PalmVisionProvider } from '../app/lib/server/palmVisionProvider';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
  if (!ok) failures++;
}

// capture everything the server logs
const logged: string[] = [];
for (const k of ['log', 'warn', 'error', 'info'] as const) {
  const orig = console[k].bind(console);
  console[k] = (...a: unknown[]) => { const line = a.map(String).join(' '); if (!line.startsWith('PASS') && !line.startsWith('FAIL')) logged.push(line); orig(...a); };
}

const ORIGIN = 'https://destiny.example';
const SESSION_SECRET = 's'.repeat(40);
const OPERATOR_SECRET = 'operator-secret-value-1234567890';
const ENV: Record<string, string> = {
  PALM_EXTRACTION_ENABLED: 'true',
  PALM_PUBLIC_ENABLED: 'true',
  OPENAI_API_KEY: 'sk-test-not-real',
  PALM_SESSION_SECRET: SESSION_SECRET,
  PALM_PUBLIC_ORIGIN: ORIGIN,
  PALM_TRUSTED_IP_HEADER: 'x-real-ip',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  PALM_EXTRACTION_SECRET: OPERATOR_SECRET,
  PALM_LIMIT_SESSION_INTERVAL_SECONDS: '0',
};
const META = { adapterVersion: 'openai-responses-1', modelRevision: 'gpt-4.1-2025-04-14', promptVersion: 'palm-vision-ko-1' };
const OBS = {
  observation: { version: 1, lines: {
    life: { status: 'visible', curvature: { status: 'observed', value: 'curved' }, continuity: { status: 'observed', value: 'continuous' } },
    head: { status: 'visible', curvature: { status: 'observed', value: 'straight' }, continuity: { status: 'observed', value: 'continuous' } },
    heart: { status: 'not-detected' },
    fate: { status: 'unreadable', reason: 'blur' },
  } },
  quality: { version: 1, usability: 'usable', palmCoverage: 'full', issues: [] },
};
const UNUSABLE = {
  observation: { version: 1, lines: Object.fromEntries(['life', 'head', 'heart', 'fate'].map((k) => [k, { status: 'unreadable', reason: 'not-visible' }])) },
  quality: { version: 1, usability: 'unusable', palmCoverage: 'none', issues: ['not-a-palm'] },
};

// ── disposable DB with the real migration ──
async function freshDb() {
  const db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  await db.exec(readFileSync(join(__dirname, '..', 'supabase', 'palm-public.sql'), 'utf8'));
  return db;
}
function pgRpc(db: PGlite): PalmRpc {
  return async (fn, args) => {
    const keys = Object.keys(args);
    const sql = `select ${fn}(${keys.map((k, i) => `${k} => $${i + 1}${k === 'p_limits' ? '::jsonb' : k.endsWith('request_id') || k === 'p_event_id' ? '::uuid' : ''}`).join(', ')}) as r`;
    const res = await db.query<{ r: unknown }>(sql, keys.map((k) => (k === 'p_limits' ? JSON.stringify(args[k]) : args[k])));
    return res.rows[0].r;
  };
}

// ── fixtures ──
let providerCalls = 0;
const provider = (payload: unknown, delayMs = 0): PalmVisionProvider => ({
  extract: async () => { providerCalls++; if (delayMs) await new Promise((r) => setTimeout(r, delayMs)); return structuredClone(payload); },
});
const failing = (kind: 'error' | 'hang'): PalmVisionProvider => ({
  extract: (_img, { signal }) => { providerCalls++; return kind === 'error' ? Promise.reject(new Error('raw provider body sk-test-not-real')) : new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))); },
});

let imgSeed = 0;
async function jpeg(): Promise<Uint8Array> {
  imgSeed++;
  const w = 800, h = 1000, raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 31 + imgSeed * 97) % 251;
  return new Uint8Array(await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 80 }).toBuffer());
}

function newSession(secret = SESSION_SECRET, nowMs = Date.now()) {
  const { session, cookieValue } = createPalmSession(secret, nowMs);
  return { cookie: `${PALM_SESSION_COOKIE}=${cookieValue}`, csrf: palmCsrfToken(secret, session.sessionId), id: session.sessionId };
}
type Sess = ReturnType<typeof newSession>;
let bodyReads = 0;
function trackedBody(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({ pull(c) { bodyReads++; c.enqueue(bytes); c.close(); } }, { highWaterMark: 0 });
}
function publicReq(bytes: Uint8Array, s: Sess | null, over: Record<string, string | null> = {}, ip: string | null = '203.0.113.7'): Request {
  const headers: Record<string, string> = {
    'content-type': 'image/jpeg', origin: ORIGIN, 'sec-fetch-site': 'same-origin',
    'x-palm-request-id': crypto.randomUUID(), 'x-palm-notice': 'palm-processing-1',
  };
  if (s) { headers.cookie = s.cookie; headers['x-palm-csrf'] = s.csrf; }
  if (ip) headers['x-real-ip'] = ip;
  for (const [k, v] of Object.entries(over)) { if (v === null) delete headers[k]; else headers[k] = v; }
  return new Request('https://destiny.example/api/palm/analyze', { method: 'POST', body: trackedBody(bytes), headers, duplex: 'half' } as RequestInit);
}
const bodyOf = async (r: Response) => JSON.parse(await r.text());

function deps(store: PalmPublicStore | (() => Promise<PalmPublicStore>), prov: PalmVisionProvider, over: Partial<PalmPublicAnalyzeDeps> = {}, env = ENV): PalmPublicAnalyzeDeps {
  return {
    env, createProvider: () => prov,
    createStore: typeof store === 'function' ? store : async () => store,
    metadata: META, requestTimeoutMs: 30_000, providerTimeoutMs: 20_000, ...over,
  };
}

async function main() {
  // ══ config / kill switch ══
  check('config: public is OFF by default', !readPalmPublicConfig({}).enabled && !readPalmPublicConfig({ ...ENV, PALM_PUBLIC_ENABLED: undefined }).enabled);
  for (const k of ['PALM_EXTRACTION_ENABLED', 'OPENAI_API_KEY', 'PALM_SESSION_SECRET', 'PALM_PUBLIC_ORIGIN', 'PALM_TRUSTED_IP_HEADER', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    check(`config: missing ${k} → public disabled (fail closed)`, !readPalmPublicConfig({ ...ENV, [k]: '' }).enabled);
  }
  check('config: short session secret → disabled', !readPalmPublicConfig({ ...ENV, PALM_SESSION_SECRET: 'short' }).enabled);
  check('config: session secret equal to operator secret → disabled', !readPalmPublicConfig({ ...ENV, PALM_SESSION_SECRET: OPERATOR_SECRET + 'x'.repeat(10), PALM_EXTRACTION_SECRET: OPERATOR_SECRET + 'x'.repeat(10) }).enabled);
  check('config: origin must be exact (no path / wildcard / http non-localhost)',
    ['https://destiny.example/', 'https://*.example', 'http://destiny.example', 'destiny.example'].every((o) => !readPalmPublicConfig({ ...ENV, PALM_PUBLIC_ORIGIN: o }).enabled));
  check('config: invalid limit value → disabled', !readPalmPublicConfig({ ...ENV, PALM_LIMIT_GLOBAL_DAILY: '-1' }).enabled);
  const cfg = readPalmPublicConfig(ENV);
  check('config: defaults 1/30s/3 per session, 10/IP, 2 concurrent/100 daily global',
    cfg.enabled && cfg.limits.sessionConcurrent === 1 && cfg.limits.sessionDaily === 3 && cfg.limits.ipDaily === 10 && cfg.limits.globalConcurrent === 2 && cfg.limits.globalDaily === 100
    && readPalmPublicConfig({ ...ENV, PALM_LIMIT_SESSION_INTERVAL_SECONDS: undefined }).enabled && (readPalmPublicConfig({ ...ENV, PALM_LIMIT_SESSION_INTERVAL_SECONDS: undefined }) as { limits: { sessionIntervalSeconds: number } }).limits.sessionIntervalSeconds === 30);

  const db = await freshDb();
  const storeA = createPalmPublicStore(pgRpc(db)); // server instance A
  const storeB = createPalmPublicStore(pgRpc(db)); // server instance B (same DB)
  const img1 = await jpeg();

  // ══ session endpoint ══
  {
    const sreq = (h: Record<string, string>) => new Request('https://destiny.example/api/palm/session', { method: 'POST', headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'x-real-ip': '198.51.100.1', ...h } });
    const off = await handlePalmSession(sreq({}), { env: { ...ENV, PALM_PUBLIC_ENABLED: 'false' }, createStore: async () => storeA });
    check('session: disabled → {enabled:false}, no cookie', off.status === 200 && (await bodyOf(off)).enabled === false && !off.headers.get('set-cookie'));
    const bad = await handlePalmSession(sreq({ origin: 'https://evil.example' }), { env: ENV, createStore: async () => storeA });
    check('session: wrong Origin → 403, no cookie', bad.status === 403 && !bad.headers.get('set-cookie'));
    const cross = await handlePalmSession(sreq({ 'sec-fetch-site': 'cross-site' }), { env: ENV, createStore: async () => storeA });
    check('session: Sec-Fetch-Site cross-site → 403', cross.status === 403);
    const ok = await handlePalmSession(sreq({}), { env: ENV, createStore: async () => storeA });
    const cookie = ok.headers.get('set-cookie') ?? '';
    const body = await bodyOf(ok);
    check('session: issues __Host- cookie (HttpOnly; Secure; SameSite=Strict; Path=/; no Domain; ≤24h)',
      ok.status === 200 && cookie.startsWith('__Host-palm_session=') && /HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=Strict/.test(cookie)
      && /Path=\//.test(cookie) && !/Domain=/i.test(cookie) && Number(/Max-Age=(\d+)/.exec(cookie)?.[1]) <= 86400);
    check('session: response carries only enabled/csrf/notice version (no secrets, no session id)',
      Object.keys(body).sort().join() === 'csrfToken,enabled,noticeVersion' && !JSON.stringify(body).includes(SESSION_SECRET) && !JSON.stringify(body).includes(cookie.split('=')[1].split('.')[0]));
    check('session: no-store', ok.headers.get('cache-control') === 'no-store');
    const reuse = await handlePalmSession(sreq({ cookie: cookie.split(';')[0] }), { env: ENV, createStore: async () => { throw new Error('store must not be needed'); } });
    check('session: valid cookie is reused without a new issuance', reuse.status === 200 && !reuse.headers.get('set-cookie') && (await bodyOf(reuse)).csrfToken === body.csrfToken);
    let limited = 0;
    for (let i = 0; i < 12; i++) if ((await handlePalmSession(sreq({ 'x-real-ip': '198.51.100.99' }), { env: ENV, createStore: async () => storeB })).status === 429) limited++;
    check('session: issuance limited per trusted IP per hour (10), across instances', limited === 2, String(limited));
    const noIp = await handlePalmSession(new Request('https://destiny.example/api/palm/session', { method: 'POST', headers: { origin: ORIGIN } }), { env: ENV, createStore: async () => storeA });
    check('session: no trusted IP → 503', noIp.status === 503);
    const down = await handlePalmSession(sreq({ 'x-real-ip': '198.51.100.2' }), { env: ENV, createStore: async () => createPalmPublicStore(async () => { throw new Error('db down'); }) });
    check('session: DB unavailable → 503, no cookie', down.status === 503 && !down.headers.get('set-cookie'));
  }

  // ══ public analyze: rejections BEFORE reading the body, provider never called ══
  {
    const s = newSession();
    const other = newSession();
    const expired = newSession(SESSION_SECRET, Date.now() - 25 * 3600_000);
    const forgedSecret = newSession('x'.repeat(40));
    const cases: Array<[string, Request, number, string, Record<string, string>?]> = [
      ['kill switch PALM_EXTRACTION_ENABLED=false', publicReq(img1, s), 503, 'UNAVAILABLE', { PALM_EXTRACTION_ENABLED: 'false' }],
      ['kill switch PALM_PUBLIC_ENABLED=false', publicReq(img1, s), 503, 'UNAVAILABLE', { PALM_PUBLIC_ENABLED: 'false' }],
      ['wrong Origin', publicReq(img1, s, { origin: 'https://evil.example' }), 403, 'ACCESS_DENIED'],
      ['missing Origin', publicReq(img1, s, { origin: null }), 403, 'ACCESS_DENIED'],
      ['Sec-Fetch-Site cross-site', publicReq(img1, s, { 'sec-fetch-site': 'cross-site' }), 403, 'ACCESS_DENIED'],
      ['no session cookie', publicReq(img1, null), 401, 'SESSION_REQUIRED'],
      ['expired session', publicReq(img1, expired), 401, 'SESSION_REQUIRED'],
      ['cookie signed with another key', publicReq(img1, forgedSecret), 401, 'SESSION_REQUIRED'],
      ['tampered cookie', publicReq(img1, s, { cookie: s.cookie.replace(/\.(\d+)\./, (_m, d) => `.${Number(d) + 1}.`) }), 401, 'SESSION_REQUIRED'],
      ['missing CSRF header', publicReq(img1, s, { 'x-palm-csrf': null }), 403, 'ACCESS_DENIED'],
      ['CSRF token of another session', publicReq(img1, s, { 'x-palm-csrf': other.csrf }), 403, 'ACCESS_DENIED'],
      ['operator secret is not a public credential', publicReq(img1, null, { 'x-palm-csrf': OPERATOR_SECRET }), 401, 'SESSION_REQUIRED'],
      ['request id not a UUID', publicReq(img1, s, { 'x-palm-request-id': 'abc' }), 400, 'INVALID_REQUEST'],
      ['processing notice not accepted', publicReq(img1, s, { 'x-palm-notice': null }), 400, 'INVALID_REQUEST'],
      ['no trusted IP header', publicReq(img1, s, {}, null), 503, 'UNAVAILABLE'],
      ['spoofed IP list', publicReq(img1, s, {}, '1.2.3.4, 5.6.7.8'), 503, 'UNAVAILABLE'],
    ];
    for (const [name, req, status, code, envOver] of cases) {
      providerCalls = 0; bodyReads = 0;
      const res = await handlePalmPublicAnalyze(req, deps(storeA, provider(OBS), {}, { ...ENV, ...(envOver ?? {}) }));
      const b = await bodyOf(res);
      check(`public reject: ${name} → ${status} ${code}, body unread, provider 0`, res.status === status && b.error?.code === code && bodyReads === 0 && providerCalls === 0,
        `${res.status} ${JSON.stringify(b)} reads=${bodyReads} calls=${providerCalls}`);
    }
  }

  // ══ success + storage safety ══
  const s1 = newSession();
  {
    providerCalls = 0;
    const res = await handlePalmPublicAnalyze(publicReq(img1, s1), deps(storeA, provider(OBS)));
    const b = await bodyOf(res);
    check('public: valid request → 200 bundle', res.status === 200 && b.ok === true && b.bundle.quality.usability === 'usable' && providerCalls === 1);
    const ledger = await db.query<{ status: string; payload_fp: string; ip_key: string; session_key: string }>('select * from palm_request_ledger');
    check('ledger: completed, only HMAC keys (no raw session id / IP / image)', ledger.rows.length === 1 && ledger.rows[0].status === 'completed'
      && ![s1.id, '203.0.113.7'].some((v) => JSON.stringify(ledger.rows).includes(v)) && ledger.rows[0].payload_fp.length === 43);
    const events = await db.query<{ event: string }>('select event from palm_events');
    check('events: server records palm_success', events.rows.some((r) => r.event === 'palm_success'));
    const cols = await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'palm_events'`);
    check('events table has no session/IP/image/trait columns', cols.rows.map((r) => r.column_name).sort().join() === 'created_at,duration_bucket,error_code,event,id,supplement_version');
    const dump = JSON.stringify((await db.query(`select * from palm_request_ledger`)).rows) + JSON.stringify((await db.query(`select * from palm_events`)).rows);
    check('DB holds no observation/bundle content', !/curvature|continuity|visible|observation|usable/.test(dump));
  }

  // ══ duplicates / conflicts ══
  {
    const fixedId = crypto.randomUUID();
    providerCalls = 0;
    const first = await handlePalmPublicAnalyze(publicReq(await jpeg(), s1, { 'x-palm-request-id': fixedId }), deps(storeA, provider(OBS)));
    const again = await handlePalmPublicAnalyze(publicReq(await jpeg(), s1, { 'x-palm-request-id': fixedId }), deps(storeB, provider(OBS)));
    check('duplicate: same request id with a different image → 409 REQUEST_CONFLICT (instance B), no provider call', first.status === 200 && again.status === 409 && (await bodyOf(again)).error.code === 'REQUEST_CONFLICT' && providerCalls === 1);
    const dupImg = await handlePalmPublicAnalyze(publicReq(img1, s1), deps(storeB, provider(OBS)));
    check('duplicate: same image, new request id, within 10 min → 409 DUPLICATE_IMAGE (no new provider call)', dupImg.status === 409 && (await bodyOf(dupImg)).error.code === 'DUPLICATE_IMAGE' && providerCalls === 1);
    const other = newSession();
    const otherSess = await handlePalmPublicAnalyze(publicReq(img1, other, {}, '203.0.113.50'), deps(storeA, provider(OBS)));
    check('duplicate: fingerprint is session-bound (another session is not blocked by it)', otherSess.status === 200);
  }
  {
    // exact resend of the same request id + same bytes → status only, no re-inference
    const s = newSession();
    const id = crypto.randomUUID();
    const img = await jpeg();
    providerCalls = 0;
    await handlePalmPublicAnalyze(publicReq(img, s, { 'x-palm-request-id': id }, '203.0.113.60'), deps(storeA, provider(OBS)));
    const resend = await handlePalmPublicAnalyze(publicReq(img, s, { 'x-palm-request-id': id }, '203.0.113.60'), deps(storeB, provider(OBS)));
    const rb = await bodyOf(resend);
    check('duplicate: resent request id → 409 DUPLICATE_REQUEST with status only, provider called once', resend.status === 409 && rb.error.code === 'DUPLICATE_REQUEST' && rb.error.requestStatus === 'completed' && providerCalls === 1);
  }

  // ══ two instances, same request concurrently → provider at most once ══
  {
    const s = newSession();
    const id = crypto.randomUUID();
    const img = await jpeg();
    providerCalls = 0;
    const [r1, r2] = await Promise.all([
      handlePalmPublicAnalyze(publicReq(img, s, { 'x-palm-request-id': id }, '203.0.113.70'), deps(storeA, provider(OBS, 50))),
      handlePalmPublicAnalyze(publicReq(img, s, { 'x-palm-request-id': id }, '203.0.113.70'), deps(storeB, provider(OBS, 50))),
    ]);
    check('concurrency: same id+image on two instances → provider called once, other 409', providerCalls === 1 && [r1.status, r2.status].sort().join() === '200,409');
    const s2 = newSession();
    providerCalls = 0;
    const [c1, c2] = await Promise.all([
      handlePalmPublicAnalyze(publicReq(await jpeg(), s2, {}, '203.0.113.71'), deps(storeA, provider(OBS, 80))),
      handlePalmPublicAnalyze(publicReq(await jpeg(), s2, {}, '203.0.113.71'), deps(storeB, provider(OBS, 80))),
    ]);
    const statuses = [c1.status, c2.status].sort().join();
    check('concurrency: one session, two different images at once → 1 provider call, other 429 (session concurrent 1)', providerCalls === 1 && statuses === '200,429', statuses);
  }

  // ══ limits ══
  {
    const db2 = await freshDb();
    const st = createPalmPublicStore(pgRpc(db2));
    const s = newSession();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await handlePalmPublicAnalyze(publicReq(await jpeg(), s, {}, '192.0.2.1'), deps(st, provider(OBS)))).status);
    check('limits: session daily 3 → 4th request 429', statuses.join() === '200,200,200,429', statuses.join());
    const r429 = await handlePalmPublicAnalyze(publicReq(await jpeg(), s, {}, '192.0.2.1'), deps(st, provider(OBS)));
    check('limits: 429 carries Retry-After', r429.status === 429 && Number(r429.headers.get('retry-after')) > 0);
    // IP daily 10 across sessions
    const ipStatuses: number[] = [];
    for (let i = 0; i < 8; i++) ipStatuses.push((await handlePalmPublicAnalyze(publicReq(await jpeg(), newSession(), {}, '192.0.2.1'), deps(st, provider(OBS)))).status);
    check('limits: trusted-IP daily 10 across sessions (3 + 7 allowed, then 429)', ipStatuses.filter((x) => x === 200).length === 7 && ipStatuses.at(-1) === 429, ipStatuses.join());
    // interval 30 s (default)
    const envInterval = { ...ENV, PALM_LIMIT_SESSION_INTERVAL_SECONDS: '30' };
    const si = newSession();
    const a = await handlePalmPublicAnalyze(publicReq(await jpeg(), si, {}, '192.0.2.2'), deps(st, provider(OBS), {}, envInterval));
    const b = await handlePalmPublicAnalyze(publicReq(await jpeg(), si, {}, '192.0.2.2'), deps(st, provider(OBS), {}, envInterval));
    check('limits: session interval 30 s → immediate second request 429', a.status === 200 && b.status === 429);
    // global daily
    const db3 = await freshDb();
    const st3 = createPalmPublicStore(pgRpc(db3));
    const envGlobal = { ...ENV, PALM_LIMIT_GLOBAL_DAILY: '2' };
    const g: number[] = [];
    for (let i = 0; i < 3; i++) g.push((await handlePalmPublicAnalyze(publicReq(await jpeg(), newSession(), {}, `192.0.2.${10 + i}`), deps(st3, provider(OBS), {}, envGlobal))).status);
    check('limits: global daily cap across sessions/IPs', g.join() === '200,200,429', g.join());
    // global concurrent 2
    const db4 = await freshDb();
    const st4a = createPalmPublicStore(pgRpc(db4)), st4b = createPalmPublicStore(pgRpc(db4));
    providerCalls = 0;
    const conc = await Promise.all([0, 1, 2].map((i) => handlePalmPublicAnalyze(publicReq(img1, newSession(), {}, `192.0.2.${30 + i}`), deps(i % 2 ? st4b : st4a, provider(OBS, 100)))));
    check('limits: global concurrent 2 across instances → third request 429', conc.map((r) => r.status).sort().join() === '200,200,429' && providerCalls === 2, conc.map((r) => r.status).join());
    // operator path counts against the global cap
    const opEnv = { ...envGlobal };
    const op = await handlePalmAnalyze(
      new Request('https://destiny.example/api/palm/analyze', { method: 'POST', body: new Uint8Array(await jpeg()), headers: { 'content-type': 'image/jpeg', 'x-palm-extraction-secret': OPERATOR_SECRET } }),
      { env: opEnv, createProvider: () => provider(OBS), gate: new PalmRequestGate(), metadata: META, requestTimeoutMs: 30_000, providerTimeoutMs: 20_000, globalBudget: { store: st3, limits: { ...cfg.enabled ? cfg.limits : ({} as never), globalDaily: 2 } } },
    );
    check('limits: operator path is included in the global daily cap (429 once public used it up)', op.status === 429);
  }

  // ══ provider failures, retry semantics, lease expiry ══
  {
    const db5 = await freshDb();
    const st = createPalmPublicStore(pgRpc(db5));
    const s = newSession();
    const img = await jpeg();
    providerCalls = 0;
    const t = await handlePalmPublicAnalyze(publicReq(img, s, {}, '192.0.2.40'), deps(st, failing('hang'), { providerTimeoutMs: 50 }));
    const st1 = (await db5.query<{ status: string }>('select status from palm_request_ledger')).rows[0]?.status;
    check('failure: provider timeout → 504, ledger uncertain (possibly billed, not refunded)', t.status === 504 && (await bodyOf(t)).error.code === 'PROVIDER_TIMEOUT' && st1 === 'uncertain');
    const e = await handlePalmPublicAnalyze(publicReq(img, s, {}, '192.0.2.40'), deps(st, failing('error')));
    const eb = await bodyOf(e);
    check('failure: explicit retry of the same image after a failure is allowed once; provider error → 503, no raw error leaked',
      e.status === 503 && eb.error.code === 'PROVIDER_ERROR' && !JSON.stringify(eb).includes('raw provider body'));
    const third = await handlePalmPublicAnalyze(publicReq(img, s, {}, '192.0.2.40'), deps(st, provider(OBS)));
    check('failure: a second retry of the same failed image → 409 DUPLICATE_IMAGE', third.status === 409 && (await bodyOf(third)).error.code === 'DUPLICATE_IMAGE');
    const inv = await handlePalmPublicAnalyze(publicReq(await jpeg(), newSession(), {}, '192.0.2.41'), deps(st, provider({ ...OBS, extra: 1 })));
    check('failure: invalid provider response → 502 INVALID_PROVIDER_RESPONSE', inv.status === 502 && (await bodyOf(inv)).error.code === 'INVALID_PROVIDER_RESPONSE');
    const un = await handlePalmPublicAnalyze(publicReq(await jpeg(), newSession(), {}, '192.0.2.42'), deps(st, provider(UNUSABLE)));
    check('unusable photo is a normal 200 observation (+ palm_unusable event)', un.status === 200 && (await bodyOf(un)).bundle.quality.usability === 'unusable'
      && (await db5.query<{ event: string }>(`select event from palm_events where event = 'palm_unusable'`)).rows.length === 1);
    // lease expiry: a crashed reservation becomes uncertain, frees concurrency, is not refunded
    await st.reserve({ kind: 'public', sessionKey: 'crashed-session-key-0000', requestId: crypto.randomUUID(), payloadFingerprint: 'fp-crashed-000000000', ipKey: 'ip-crashed', limits: cfg.enabled ? cfg.limits : ({} as never) });
    await db5.exec(`update palm_request_ledger set lease_expires_at = now() - interval '1 second' where session_key = 'crashed-session-key-0000'`);
    await st.reserve({ kind: 'public', sessionKey: 'other-session-key-00000', requestId: crypto.randomUUID(), payloadFingerprint: 'fp-other-00000000000', ipKey: 'ip-other', limits: cfg.enabled ? cfg.limits : ({} as never) });
    const crashed = (await db5.query<{ status: string; error_code: string }>(`select status, error_code from palm_request_ledger where session_key = 'crashed-session-key-0000'`)).rows[0];
    check('lease: expired reservation becomes uncertain (LEASE_EXPIRED) on the next reserve', crashed.status === 'uncertain' && crashed.error_code === 'LEASE_EXPIRED');
    check('finalize never overwrites a terminal state', !(await db5.query<{ r: boolean }>(`select palm_finalize('crashed-session-key-0000', (select request_id from palm_request_ledger where session_key = 'crashed-session-key-0000'), 'completed', null) as r`)).rows[0].r);
  }

  // ══ fail closed on storage problems ══
  {
    const s = newSession();
    const down = createPalmPublicStore(async () => { throw new Error('connection refused to db host with password'); });
    providerCalls = 0;
    const r1 = await handlePalmPublicAnalyze(publicReq(await jpeg(), s), deps(down, provider(OBS)));
    check('fail closed: DB unavailable → 503, provider 0, no DB error text leaked', r1.status === 503 && providerCalls === 0 && !(await r1.text()).includes('password'));
    const garbage = createPalmPublicStore(async () => ({ outcome: 'reserved-ish' }));
    const r2 = await handlePalmPublicAnalyze(publicReq(await jpeg(), s), deps(garbage, provider(OBS)));
    check('fail closed: unexpected RPC response → 503, provider 0', r2.status === 503 && providerCalls === 0);
    const noStart: PalmPublicStore = { ...createPalmPublicStore(pgRpc(await freshDb())), markStarted: async () => false };
    const r3 = await handlePalmPublicAnalyze(publicReq(await jpeg(), s), deps(noStart, provider(OBS)));
    check('fail closed: reservation cannot move to provider-started → 503, provider 0', r3.status === 503 && providerCalls === 0);
    const r4 = await handlePalmPublicAnalyze(publicReq(await jpeg(), s), deps(async () => { throw new Error('init'); }, provider(OBS)));
    check('fail closed: store init failure → 503', r4.status === 503 && providerCalls === 0);
    let threw = false;
    try { await down.reserve({ kind: 'public', sessionKey: 'x'.repeat(20), requestId: crypto.randomUUID(), payloadFingerprint: 'y'.repeat(20), ipKey: 'z'.repeat(10), limits: cfg.enabled ? cfg.limits : ({} as never) }); } catch (e) { threw = e instanceof PalmGateUnavailable && !String(e).includes('password'); }
    check('gate: DB errors are normalised to PalmGateUnavailable (no raw text)', threw);
  }

  // ══ image validation on the public path (HEIC, spoofing, size) ══
  {
    const db6 = await freshDb();
    const st = createPalmPublicStore(pgRpc(db6));
    providerCalls = 0;
    const heicHeader = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0, 0x6d, 0x69, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63]);
    const heic = await handlePalmPublicAnalyze(publicReq(heicHeader, newSession(), { 'content-type': 'image/heic' }), deps(st, provider(OBS)));
    check('HEIC: image/heic → 415 INVALID_IMAGE, provider 0, no reservation', heic.status === 415 && (await bodyOf(heic)).error.code === 'INVALID_IMAGE' && providerCalls === 0);
    const heicAsJpeg = await handlePalmPublicAnalyze(publicReq(heicHeader, newSession()), deps(st, provider(OBS)));
    check('HEIC bytes labelled image/jpeg → rejected by signature check, provider 0', [415, 422].includes(heicAsJpeg.status) && providerCalls === 0);
    const big = await handlePalmPublicAnalyze(publicReq(new Uint8Array(10), newSession(), { 'content-length': '4000001' }), deps(st, provider(OBS)));
    check('size: declared content-length above 4 MB → 413', big.status === 413 && providerCalls === 0);
    check('rejected images never consume budget', (await db6.query('select * from palm_request_ledger')).rows.length === 0);
  }

  // ══ events endpoint ══
  {
    const db7 = await freshDb();
    const st = createPalmPublicStore(pgRpc(db7));
    const s = newSession();
    const ev = (body: unknown, over: Record<string, string> = {}) => handlePalmEvent(new Request('https://destiny.example/api/palm/events', {
      method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin: ORIGIN, 'sec-fetch-site': 'same-origin', cookie: s.cookie, 'x-palm-csrf': s.csrf, ...over },
    }), { env: ENV, createStore: async () => st });
    const ok = await ev({ eventId: crypto.randomUUID(), event: 'palm_prompt_viewed' });
    check('events: allowed client event recorded (202)', ok.status === 202);
    check('events: palm_success from the client is refused (server-side only)', (await ev({ eventId: crypto.randomUUID(), event: 'palm_success' })).status === 400);
    check('events: extra fields (e.g. trait / baseId) refused', (await ev({ eventId: crypto.randomUUID(), event: 'palm_started', trait: '분석적' })).status === 400);
    check('events: oversized body refused', (await ev('x'.repeat(600))).status === 413);
    check('events: wrong Origin refused', (await ev({ eventId: crypto.randomUUID(), event: 'palm_started' }, { origin: 'https://evil.example' })).status === 403);
    check('events: missing CSRF refused', (await ev({ eventId: crypto.randomUUID(), event: 'palm_started' }, { 'x-palm-csrf': 'nope' })).status === 403);
    const id = crypto.randomUUID();
    await ev({ eventId: id, event: 'palm_retry' });
    await ev({ eventId: id, event: 'palm_retry' });
    check('events: duplicate event id stored once', (await db7.query(`select * from palm_events where id = '${id}'`)).rows.length === 1);
    let limited = false;
    for (let i = 0; i < 60 && !limited; i++) limited = (await ev({ eventId: crypto.randomUUID(), event: 'palm_started' })).status === 429;
    check('events: per-session daily event limit', limited);
    check('events: disabled feature → 204 no-op', (await handlePalmEvent(new Request('https://destiny.example/api/palm/events', { method: 'POST', body: '{}' }), { env: {}, createStore: async () => st })).status === 204);
  }

  // ══ database permissions + cleanup ══
  {
    const d = await freshDb();
    for (const [role, sql] of [
      ['anon', `select palm_reserve('public', 'x'.repeat(20), gen_random_uuid(), 'y'.repeat(20), 'z'.repeat(10), '{}'::jsonb)`],
      ['anon', 'select * from palm_request_ledger'],
      ['authenticated', 'select * from palm_events'],
      ['anon', `insert into palm_events (id, event) values (gen_random_uuid(), 'palm_started')`],
      ['authenticated', 'select palm_cleanup()'],
    ] as const) {
      let denied = false;
      try { await d.exec(`set role ${role}; ${sql.replace(/'x'\.repeat\(20\)/, `'${'x'.repeat(20)}'`).replace(/'y'\.repeat\(20\)/, `'${'y'.repeat(20)}'`).replace(/'z'\.repeat\(10\)/, `'${'z'.repeat(10)}'`)};`); } catch (e) { denied = /permission denied/.test(String(e)); }
      await d.exec('reset role;');
      check(`db: ${role} cannot run "${sql.slice(0, 40)}…"`, denied);
    }
    await d.exec(`insert into palm_request_ledger (session_key, request_id, kind, payload_fp, ip_key, status, lease_expires_at, created_at)
      values ('old-session-key-0000000', gen_random_uuid(), 'public', 'fp-old-0000000000000', 'ip-old-00', 'completed', now(), now() - interval '25 hours');
      insert into palm_events (id, event, created_at) values (gen_random_uuid(), 'palm_started', now() - interval '31 days');
      insert into palm_session_issuance (ip_key, created_at) values ('ip-old-00', now() - interval '25 hours');`);
    const c = (await d.query<{ r: Record<string, number> }>('select palm_cleanup() as r')).rows[0].r;
    check('cleanup: expired ledger/issuance rows and 30-day-old events are deleted', c.ledger === 1 && c.events === 1 && c.issuance === 1
      && (await d.query('select * from palm_request_ledger')).rows.length === 0);
  }

  // ══ secret isolation / raw data (static + runtime) ══
  {
    const root = join(__dirname, '..');
    const walk = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(dir, e.name)) : /\.(tsx?|mjs)$/.test(e.name) ? [join(dir, e.name)] : []);
    const clientFiles = [...walk('app/components'), 'app/page.tsx', ...readdirSync(join(root, 'app/lib')).filter((f) => /\.ts$/.test(f)).map((f) => `app/lib/${f}`)];
    const clientSrc = clientFiles.map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
    check('secrets: no browser-side file references server secrets',
      !/PALM_EXTRACTION_SECRET|PALM_SESSION_SECRET|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|x-palm-extraction-secret/.test(clientSrc));
    check('secrets: no NEXT_PUBLIC_ variant of Palm/OpenAI secrets anywhere', !walk('app').some((f) => /NEXT_PUBLIC_(PALM|OPENAI|SUPABASE_SERVICE)/.test(readFileSync(join(root, f), 'utf8'))));
    const serverSrc = readdirSync(join(root, 'app/lib/server')).map((f) => readFileSync(join(root, 'app/lib/server', f), 'utf8')).join('\n');
    check('logging: server Palm code logs only normalised codes (no image/body/header/IP/cookie variables)',
      !/console\.(log|info|error|warn)\([^)]*(bytes|body|cookie|ip\b|headers|bundle|raw|secret|apiKey|base64)/i.test(serverSrc));
    const leaked = logged.filter((l) => /sk-test|service-role|s{40}|203\.0\.113|base64|__Host-palm_session=|data:image/.test(l));
    check('logging: nothing secret/IP/cookie/image-like was logged during the whole run', leaked.length === 0, leaked.join(' | '));
    check('raw images: no server code writes files or uploads images to storage',
      !/writeFile|createWriteStream|storage\.from\(|\.upload\(/.test(serverSrc));
  }

  if (failures) {
    console.log(`\nFAIL: ${failures} palm-public check(s) failed`);
    process.exit(1);
  }
  console.log('\nPASS: all palm-public regression checks');
}

main().catch((e) => { console.log(`FAIL: unexpected ${(e as Error).stack}`); process.exit(1); });
