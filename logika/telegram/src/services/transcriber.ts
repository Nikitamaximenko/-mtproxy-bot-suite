/**
 * Voice-to-text for ULTRA users.
 *
 * Anthropic doesn't expose native audio transcription, so we route the OGG/Opus
 * file through a dedicated ASR service. Swap the implementation to whatever
 * vendor you prefer — the signature is stable.
 *
 * Candidates:
 * - Deepgram (`nova-2`, ru) — lowest latency, good RU accuracy
 * - OpenAI Whisper API — widely compatible fallback
 * - Yandex SpeechKit — if staying in RU infra for compliance
 */
export async function transcribeVoice(_fileUrl: string): Promise<string> {
  // TODO: implement ASR call. Keep the interface; swap the body.
  throw new Error('transcribeVoice: wire ASR provider in services/transcriber.ts')
}
