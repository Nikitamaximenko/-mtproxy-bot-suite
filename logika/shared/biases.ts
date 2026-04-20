import type { Bias } from './types'

/**
 * Curated catalog of cognitive biases the analyzer looks for.
 * Keep descriptions short — they are shown both in web UI and Telegram chat.
 */
export const BIAS_CATALOG: Bias[] = [
  {
    key: 'recency',
    name: 'Свежесть события',
    description: 'Недавнее событие получает непропорциональный вес без пересчёта базовой линии.',
  },
  {
    key: 'confirmation',
    name: 'Поиск подтверждения',
    description: 'Аргументы «за» накапливаются быстрее, чем контрпримеры.',
  },
  {
    key: 'blackwhite',
    name: 'Чёрно-белое мышление',
    description: 'Спектр сведён к двум крайностям, середина не рассмотрена.',
  },
  {
    key: 'sunkcost',
    name: 'Невозвратные затраты',
    description: 'Прошлые вложения используются как аргумент продолжать.',
  },
  {
    key: 'availability',
    name: 'Доступность',
    description: 'Пример, который пришёл в голову первым, воспринимается как типичный.',
  },
  {
    key: 'anchoring',
    name: 'Якорение',
    description: 'Первая услышанная цифра или формулировка искажает последующие оценки.',
  },
  {
    key: 'projection',
    name: 'Проекция',
    description: 'Свои предпочтения приписываются другим людям и общему миру.',
  },
  {
    key: 'hindsight',
    name: 'Пост-знание',
    description: 'Задним числом кажется, что итог был очевиден — и это меняет нынешний выбор.',
  },
]
