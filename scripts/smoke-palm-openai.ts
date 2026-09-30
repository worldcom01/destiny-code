// MANUAL, OPTIONAL live smoke test for the Palm Phase 1B OpenAI extraction path. Costs money.
// Not part of any npm script, regression, build or CI. Requires an explicit --live flag and OPENAI_API_KEY.
//
//   OPENAI_API_KEY=sk-... npx -y tsx --conditions=react-server scripts/smoke-palm-openai.ts --live --synthetic
//   OPENAI_API_KEY=sk-... npx -y tsx --conditions=react-server scripts/smoke-palm-openai.ts --live --image /path/outside/repo.jpg
//
// --synthetic sends a generated non-personal image (checks transport + strict schema + parser only).
// --image uses a local, consented photo kept OUTSIDE the repository. Never commit palm photos.
// Prints the validated observation, error code and latency only — never the image, base64 or raw provider response.
// Passing this smoke test does NOT establish palm-line reading accuracy (see the 8–12 image manual evaluation).

import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { preparePalmImage, PalmImageError } from '../app/lib/server/palmImage';
import { extractPalmObservation } from '../app/lib/server/palmExtraction';
import { PalmProviderError } from '../app/lib/server/palmVisionProvider';
import {
  createOpenAIPalmVisionProvider, PALM_OPENAI_ADAPTER_VERSION, PALM_OPENAI_MODEL, PALM_VISION_PROMPT_VERSION,
} from '../app/lib/server/openaiPalmVision';

async function main() {
  const args = process.argv.slice(2);
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  if (!args.includes('--live') || !apiKey) {
    console.log('Refusing to run: pass --live explicitly and set OPENAI_API_KEY (this makes one paid API call).');
    process.exit(2);
  }
  let bytes: Uint8Array;
  let mime: string;
  const imageAt = args.indexOf('--image');
  if (imageAt >= 0 && args[imageAt + 1]) {
    const path = args[imageAt + 1];
    if (path.startsWith(process.cwd())) {
      console.log('Refusing: keep evaluation photos outside the repository.');
      process.exit(2);
    }
    bytes = new Uint8Array(readFileSync(path));
    mime = path.toLowerCase().endsWith('.png') ? 'image/png' : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  } else if (args.includes('--synthetic')) {
    bytes = new Uint8Array(await sharp({ create: { width: 1200, height: 1600, channels: 3, background: { r: 205, g: 170, b: 150 } } }).jpeg().toBuffer());
    mime = 'image/jpeg';
  } else {
    console.log('Pass --synthetic or --image <path outside the repo>.');
    process.exit(2);
  }

  const started = Date.now();
  try {
    const prepared = await preparePalmImage(bytes, mime);
    const bundle = await extractPalmObservation(prepared, createOpenAIPalmVisionProvider({ apiKey }), {
      signal: new AbortController().signal,
      metadata: { adapterVersion: PALM_OPENAI_ADAPTER_VERSION, modelRevision: PALM_OPENAI_MODEL, promptVersion: PALM_VISION_PROMPT_VERSION },
      providerTimeoutMs: 20_000,
    });
    console.log(`ok in ${Date.now() - started} ms (model ${PALM_OPENAI_MODEL}, prepared ${prepared.width}x${prepared.height})`);
    console.log(JSON.stringify({ observation: bundle.observation, quality: bundle.quality }, null, 2));
  } catch (e) {
    const code = e instanceof PalmImageError || e instanceof PalmProviderError ? e.failure : 'unexpected';
    console.log(`failed in ${Date.now() - started} ms: ${code}`);
    process.exit(1);
  }
}

main();
