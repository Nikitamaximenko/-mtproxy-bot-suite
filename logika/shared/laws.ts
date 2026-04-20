import type { LawKey } from './types'

/**
 * Four classical laws of logic — shared source of truth
 * for the landing, the analysis engine, and the Telegram bot.
 */
export const LAWS: Record<LawKey, { title: string; formula: string; short: string }> = {
  identity: {
    title: 'Закон тождества',
    formula: 'A = A',
    short:
      'Если ты называешь это «любовью» в начале разговора, это должно быть любовью и в конце.',
  },
  noncontradiction: {
    title: 'Закон непротиворечия',
    formula: 'A ≠ ¬A',
    short:
      'Нельзя хотеть свободы и стабильности в одной точке, в одно и то же время.',
  },
  excludedMiddle: {
    title: 'Закон исключённого третьего',
    formula: 'A ∨ ¬A',
    short:
      'Либо ты уходишь, либо остаёшься. «Подумаю» — это не третий вариант, это отсрочка боли.',
  },
  sufficientReason: {
    title: 'Закон достаточного основания',
    formula: 'A → B',
    short:
      'За каждым «я решил» должно стоять «потому что». Нет «потому что» — решил не ты.',
  },
}

export const LAW_KEYS: LawKey[] = [
  'identity',
  'noncontradiction',
  'excludedMiddle',
  'sufficientReason',
]
