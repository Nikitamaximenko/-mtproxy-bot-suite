import { InlineKeyboard } from 'grammy'

export const mainMenu = () =>
  new InlineKeyboard()
    .text('🔍 Разобрать решение', 'action:ask')
    .row()
    .text('📜 История', 'action:history')
    .text('👤 Тариф', 'action:tariff')

export const analyzeAgain = () =>
  new InlineKeyboard()
    .text('Разобрать ещё одно', 'action:ask')
    .text('В кабинет на вебе', 'https://logika.app/kabinet')
