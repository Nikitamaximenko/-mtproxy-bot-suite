import type { LawKey } from './types.js'

export const LAW_KEYS: LawKey[] = [
  'identity',
  'noncontradiction',
  'excluded-middle',
  'sufficient-reason',
]

export const LAWS: Record<LawKey, { title: string; formula: string; short: string }> = {
  identity: {
    title: 'Закон тождества',
    formula: 'A = A',
    short: 'Одно и то же понятие — в одном и том же смысле от начала до конца.',
  },
  noncontradiction: {
    title: 'Закон непротиворечия',
    formula: 'A ≠ ¬A',
    short: 'Нельзя одновременно утверждать и отрицать одно и то же в одном контексте.',
  },
  'excluded-middle': {
    title: 'Закон исключённого третьего',
    formula: 'A ∨ ¬A',
    short: '«Подумаю» — не третий вариант, это побег от выбора.',
  },
  'sufficient-reason': {
    title: 'Закон достаточного основания',
    formula: 'A → B',
    short: 'Каждое «я решил» требует ответа на «почему». Нет ответа — решил не ты.',
  },
}
