import Anthropic from '@anthropic-ai/sdk'
import type { AnalysisRequest, AnalysisReport } from '../../../shared/types.js'
import { SYSTEM_PROMPT } from '../../../shared/prompts.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7'

export async function analyzeDialog(req: AnalysisRequest): Promise<AnalysisReport> {
  const userContent = req.dialog
    .map((t) => (t.role === 'user' ? `USER: ${t.text}` : `BOT: ${t.text}`))
    .join('\n\n')

  const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userContent }],
  })

  const final = await stream.finalMessage()
  const text = final.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')

  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('analyzer: model did not return JSON')
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Omit<
    AnalysisReport,
    'id' | 'userId' | 'createdAt'
  >

  return {
    ...parsed,
    id: crypto.randomUUID(),
    userId: req.userId,
    createdAt: new Date().toISOString(),
  }
}
