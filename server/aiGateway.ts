import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const AUTHORIZED_SUPER_ADMIN_EMAIL = 'aravindvicky629@gmail.com';

export const DEFAULT_PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
// gemini-3.5-flash-lite first: the most consistently available model under load
export const DEFAULT_FALLBACK_GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;
/** Extra models tried after the configured ones when Gemini reports high demand. */
export const EXTRA_OVERLOAD_FALLBACK_MODELS = ['gemini-3.8-flash'] as const;
/** Passes over the whole model list before giving up on transient overload. */
const OVERLOAD_RETRY_ROUNDS = 2;
/** Pause between passes so a short Gemini demand spike can clear. */
const OVERLOAD_ROUND_PAUSE_MS = 2000;
/** Stop starting new attempts after this long, so the chat never hangs. */
const GENERATION_TIME_BUDGET_MS = 45000;
export const EMBEDDING_MODEL_ID = 'gemini-embedding-2';
export const EMBEDDING_DIMENSION = 768;

export interface StoredAiConfigRow {
  model?: string | null;
  temperature?: number | null;
  latency_sla?: number | null;
  guardrail_active?: boolean | null;
  hallucination_filter?: boolean | null;
  sentinel_confidence_threshold?: number | null;
  auto_freeze_threshold?: number | null;
  max_daily_wire_velocity?: number | null;
  dual_key_signoff_enabled?: boolean | null;
  real_time_audit_logging?: boolean | null;
  is_active?: boolean | null;
  updated_at?: string | null;
}

export interface ResolvedServerAiConfig {
  configuredProfile: string;
  primaryModel: string;
  fallbackModels: string[];
  temperature: number;
  guardrailActive: boolean;
  hallucinationFilter: boolean;
  latencySlaMs: number;
  sentinelConfidenceThreshold: number;
  autoFreezeThreshold: number;
  maxDailyWireVelocity: number;
  dualKeySignoffEnabled: boolean;
  source: 'database' | 'default';
}

const LOGICAL_MODEL_TO_RUNTIME: Record<
  string,
  { primary: string; fallbacks: string[] }
> = {
  'Finova-Sentinel-Ultra-4.2': {
    primary: 'gemini-4-hydrogen',
    fallbacks: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  },
  'Finova-Forensic-Vision-6.1': {
    primary: 'gemini-4-hydrogen',
    fallbacks: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  },
  'Finova-Yield-Optimizer-3.9': {
    primary: 'gemini-3.1-flash-lite',
    fallbacks: ['gemini-3.5-flash-lite', 'gemini-4-hydrogen'],
  },
  'gemini-4-hydrogen': {
    primary: 'gemini-4-hydrogen',
    fallbacks: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  },
  'gemini-3.1-flash-lite': {
    primary: 'gemini-3.1-flash-lite',
    fallbacks: ['gemini-3.5-flash-lite'],
  },
  'gemini-3.5-flash-lite': {
    primary: 'gemini-3.5-flash-lite',
    fallbacks: ['gemini-3.1-flash-lite'],
  },
};

export function clampTemperature(val: unknown, fallback = 0.2): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(Math.min(1.0, Math.max(0.0, num)) * 100) / 100;
}

export function resolveServerAiConfig(
  row?: StoredAiConfigRow | null
): ResolvedServerAiConfig {
  const rawModel = String(row?.model || 'Finova-Sentinel-Ultra-4.2').trim();
  const mapped =
    LOGICAL_MODEL_TO_RUNTIME[rawModel] ||
    LOGICAL_MODEL_TO_RUNTIME['Finova-Sentinel-Ultra-4.2'];

  const latencyNum = Number(row?.latency_sla);
  const latencySlaMs =
    Number.isFinite(latencyNum) && latencyNum >= 50 && latencyNum <= 30000
      ? Math.round(latencyNum)
      : 250;

  return {
    configuredProfile: LOGICAL_MODEL_TO_RUNTIME[rawModel]
      ? rawModel
      : 'Finova-Sentinel-Ultra-4.2',
    primaryModel: mapped.primary,
    fallbackModels: [...mapped.fallbacks],
    temperature: clampTemperature(row?.temperature, 0.2),
    guardrailActive:
      row?.guardrail_active !== undefined && row?.guardrail_active !== null
        ? Boolean(row.guardrail_active)
        : true,
    hallucinationFilter:
      row?.hallucination_filter !== undefined && row?.hallucination_filter !== null
        ? Boolean(row.hallucination_filter)
        : true,
    latencySlaMs,
    sentinelConfidenceThreshold: Number(row?.sentinel_confidence_threshold ?? 92),
    autoFreezeThreshold: Number(row?.auto_freeze_threshold ?? 85),
    maxDailyWireVelocity: Number(row?.max_daily_wire_velocity ?? 5000000),
    dualKeySignoffEnabled:
      row?.dual_key_signoff_enabled !== undefined &&
      row?.dual_key_signoff_enabled !== null
        ? Boolean(row.dual_key_signoff_enabled)
        : true,
    source: row ? 'database' : 'default',
  };
}

export async function loadActiveServerAiConfig(
  supabaseClient: any
): Promise<ResolvedServerAiConfig> {
  try {
    const { data, error } = await supabaseClient
      .from('ai_configurations')
      .select(
        'model, temperature, latency_sla, guardrail_active, hallucination_filter, sentinel_confidence_threshold, auto_freeze_threshold, max_daily_wire_velocity, dual_key_signoff_enabled, real_time_audit_logging, is_active, updated_at'
      )
      .eq('is_active', true)
      .eq('tenant_id', 'platform_root')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[AI Config] Falling back to hardened defaults:', error.code || error.message);
      return resolveServerAiConfig(null);
    }
    return resolveServerAiConfig(data);
  } catch (err) {
    console.warn('[AI Config] Lookup failed cleanly, using hardened defaults:', (err as Error)?.message);
    return resolveServerAiConfig(null);
  }
}

export function createGeminiClient(apiKey: string, timeoutMs = 15000): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: timeoutMs,
    },
  });
}

export function isGemini4Model(modelId: string): boolean {
  return modelId.startsWith('gemini-4-');
}

export function isTransientGeminiError(err: unknown): boolean {
  const e = err as { status?: number; code?: number; message?: string };
  const status = Number(e?.status || e?.code || 0);
  const msg = String(e?.message || '').toLowerCase();

  // Never treat auth/key/bad-request/model-not-found errors as transient retries
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return false;
  }
  if (
    msg.includes('api_key_invalid') ||
    msg.includes('permission_denied') ||
    msg.includes('no longer available') ||
    msg.includes('invalid argument')
  ) {
    return false;
  }

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('deadline') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('abort') ||
    msg.includes('resource_exhausted') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset')
  );
}

export function buildGenerateConfigForModel(
  modelId: string,
  systemInstruction: string,
  temperature: number
): Record<string, unknown> {
  if (isGemini4Model(modelId)) {
    // Gemini 4 series: do NOT pass deprecated sampling params (temperature/topP/topK) or thinkingBudget
    return {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    };
  }
  return {
    systemInstruction,
    temperature: clampTemperature(temperature, 0.2),
  };
}

export interface RetryOptions {
  baseDelayMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function generateWithResilientFailover(params: {
  genAI: GoogleGenAI;
  config: ResolvedServerAiConfig;
  contents: unknown;
  systemInstruction: string;
  retryOptions?: RetryOptions;
}): Promise<{
  answer: string;
  model: string;
  usage: Record<string, unknown>;
  attempts: number;
}> {
  const { genAI, config, contents, systemInstruction, retryOptions } = params;
  const candidateModels = Array.from(
    new Set([config.primaryModel, ...config.fallbackModels, ...EXTRA_OVERLOAD_FALLBACK_MODELS])
  );
  const sleepFn = retryOptions?.sleepFn || defaultSleep;
  const baseDelay = retryOptions?.baseDelayMs ?? 300;
  const startedAt = Date.now();

  let lastGenErr: unknown = null;
  let totalAttempts = 0;

  // Two passes over the model list: Gemini "high demand" (503) / deadline (504)
  // spikes usually clear within seconds, so after every model fails once we
  // pause briefly and try the list again, within an overall time budget.
  for (let round = 1; round <= OVERLOAD_RETRY_ROUNDS; round++) {
  if (round > 1) {
    if (Date.now() - startedAt > GENERATION_TIME_BUDGET_MS) break;
    console.warn(`[Gemini Gateway] All models busy; retrying model list (round ${round}/${OVERLOAD_RETRY_ROUNDS}).`);
    await sleepFn(OVERLOAD_ROUND_PAUSE_MS);
  }
  for (let i = 0; i < candidateModels.length; i++) {
    if (Date.now() - startedAt > GENERATION_TIME_BUDGET_MS) break;
    const modelId = candidateModels[i];
    const maxAttempts = i === 0 && round === 1 ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      totalAttempts++;
      try {
        const modelConfig = buildGenerateConfigForModel(
          modelId,
          systemInstruction,
          config.temperature
        );

        const genResult = await genAI.models.generateContent({
          model: modelId,
          contents: contents as any,
          config: modelConfig as any,
        });

        const text = (genResult.text || '').trim();
        if (!text) {
          const finishReason =
            genResult.candidates?.[0]?.finishReason || 'EMPTY_RESPONSE';
          throw new Error(`Model synthesis returned empty response (${finishReason}).`);
        }

        return {
          answer: text,
          model: modelId,
          usage: (genResult.usageMetadata || {}) as Record<string, unknown>,
          attempts: totalAttempts,
        };
      } catch (err) {
        lastGenErr = err;
        const errMsg = String((err as Error)?.message || err);
        const errStatus = Number(
          (err as { status?: number; code?: number })?.status ||
            (err as { code?: number })?.code ||
            0
        );

        console.error(
          `[Gemini Gateway] Model ${modelId} failed (attempt ${attempt}/${maxAttempts}, status=${errStatus || 'N/A'})`
        );

        if (!isTransientGeminiError(err)) {
          throw err;
        }

        // Fail over immediately on 504 deadline exceeded instead of waiting again on the same model
        if (errStatus === 504 || errMsg.toLowerCase().includes('deadline')) {
          break;
        }

        if (attempt < maxAttempts) {
          const jitter = Math.floor(Math.random() * 120);
          const delayMs = baseDelay * Math.pow(2, attempt - 1) + jitter;
          await sleepFn(delayMs);
        }
      }
    }
  }
  }

  throw lastGenErr instanceof Error
    ? lastGenErr
    : new Error('All configured Gemini models failed during generation.');
}

export async function generateEmbedding768(
  genAI: GoogleGenAI,
  text: string,
  retryOptions?: RetryOptions
): Promise<number[]> {
  const sleepFn = retryOptions?.sleepFn || defaultSleep;
  const baseDelay = retryOptions?.baseDelayMs ?? 250;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const embedResult = await genAI.models.embedContent({
        model: EMBEDDING_MODEL_ID,
        contents: [text],
        config: { outputDimensionality: EMBEDDING_DIMENSION },
      });

      const vec = embedResult.embeddings?.[0]?.values || [];
      if (vec.length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Embedding dimensionality mismatch: expected ${EMBEDDING_DIMENSION}, received ${vec.length}.`
        );
      }
      return vec;
    } catch (err) {
      lastErr = err;
      if (!isTransientGeminiError(err) || attempt >= 2) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 100);
      await sleepFn(baseDelay + jitter);
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('Embedding generation failed.');
}
