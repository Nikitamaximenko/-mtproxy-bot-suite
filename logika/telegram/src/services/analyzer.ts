import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '../../../shared/prompts.js'
import type { AnalysisReport, AnalysisRequest } from '../../../shared/types.js'

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7'

let _client: Anthropic | null = null
const client = () => {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')
  _client = new Anthropic({ apiKey })
  return _client
}

/**
 * Calls Claude with adaptive thinking and streaming, parses a JSON report,
 * and lifts it into the shared AnalysisReport shape.
 *
 * Prompt caching: SYSTEM_PROMPT is long and stable — cached with
 * cache_control so repeat runs cost less and are faster.
 */
export async function analyze(req: AnalysisRequest): Promise<AnalysisReport> {
  const userContent = [
    `Дилемма: ${req.firstQuestion}`,
    '',
    'Диалог:',
    ...req.dialog.map((t) =>
      t.role === 'user' ? `  Пользователь: ${t.text}` : `  Логика: ${t.text}`,
    ),
    '',
    'Верни валидный JSON по схеме, без markdown-обёртки.',
  ].join('\n')

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: 'adaptive' } as never,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      } as never,
    ],
    messages: [{ role: 'user', content: userContent }],
  })

  const final = await stream.finalMessage()
  const text = final.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const json = extractJson(text)
  const parsed = JSON.parse(json) as Omit<AnalysisReport, 'id' | 'userId' | 'createdAt' | 'source'>

  return {
    ...parsed,
    id: `LG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    userId: req.userId,
    createdAt: new Date().toISOString(),
    source: req.source,
  }
}

function extractJson(raw: string): string {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('analyzer: no JSON in response')
  return raw.slice(start, end + 1)
}
