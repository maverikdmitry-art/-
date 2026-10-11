import { GoogleGenAI } from '@google/genai';

/**
 * Единая точка создания клиента Google Gemini (@google/genai).
 * Ключ передаётся снаружи и НИКОГДА не попадает в браузерный бандл:
 *  - в боте клиент создаётся в Node-процессе;
 *  - в вебе — внутри Supabase Edge Function (см. supabase/functions/parse).
 */
export function createGeminiClient(apiKey: string): GoogleGenAI {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не задан. Добавь его в .env');
  }
  return new GoogleGenAI({ apiKey });
}

export type { GoogleGenAI };
