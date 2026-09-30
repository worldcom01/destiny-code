import 'server-only';
import { createPalmPublicStore, createSupabasePalmRpc, type PalmPublicStore } from './palmPublicGate';
import {
  createOpenAIPalmVisionProvider,
  PALM_OPENAI_ADAPTER_VERSION,
  PALM_OPENAI_MODEL,
  PALM_VISION_PROMPT_VERSION,
} from './openaiPalmVision';

// route handler들이 공유하는 production 연결. 테스트는 handler에 fake를 직접 주입한다.
export const palmExtractionMetadata = {
  adapterVersion: PALM_OPENAI_ADAPTER_VERSION,
  modelRevision: PALM_OPENAI_MODEL,
  promptVersion: PALM_VISION_PROMPT_VERSION,
};

export const createPalmProvider = (apiKey: string) => createOpenAIPalmVisionProvider({ apiKey });

let cached: { key: string; store: PalmPublicStore } | null = null;

export async function createPalmStore(config: { supabaseUrl: string; supabaseServiceKey: string }): Promise<PalmPublicStore> {
  const key = `${config.supabaseUrl}|${config.supabaseServiceKey.length}`;
  if (!cached || cached.key !== key) {
    cached = { key, store: createPalmPublicStore(await createSupabasePalmRpc(config.supabaseUrl, config.supabaseServiceKey)) };
  }
  return cached.store;
}
