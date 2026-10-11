import type { GoogleGenAI } from '@google/genai';

/**
 * Распознавание голоса (аналог Whisper, но через Gemini — один ключ на всё).
 * Принимает аудио в base64 и возвращает текст. Файл нигде не сохраняется
 * (ARCHITECTURE.md 4.2: голосовые файлы удаляются после распознавания).
 */

export type TranscribeOptions = {
  client: GoogleGenAI;
  model: string;
};

export type AudioInput = {
  /** Аудио, закодированное в base64 (без data-префикса). */
  data: string;
  /** MIME-тип, например 'audio/ogg' (у Telegram voice это 'audio/ogg'). */
  mimeType: string;
  /** Необязательная подсказка — контекст для точности. */
  languageHint?: string;
};

const TRANSCRIPTION_PROMPT =
  'Распознай речь на этом аудио (обычно это бытовая фраза про трату или доход, часто по-русски или по-украински). ' +
  'Верни ТОЛЬКО распознанный текст одной строкой, без кавычек, пояснений и знаков препинания в конце. ' +
  'Если речь неразборчива — верни пустую строку.';

/** Распознать аудио в текст. Бросает исключение при сбое. */
export async function transcribeAudio(audio: AudioInput, options: TranscribeOptions): Promise<string> {
  const prompt = audio.languageHint
    ? `${TRANSCRIPTION_PROMPT} Язык подсказки: ${audio.languageHint}.`
    : TRANSCRIPTION_PROMPT;

  const response = await options.client.models.generateContent({
    model: options.model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { data: audio.data, mimeType: audio.mimeType } },
        ],
      },
    ],
    config: { temperature: 0 },
  });

  const text = response.text?.trim() ?? '';
  return text;
}
