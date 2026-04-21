import { InlineKeyboard } from 'grammy'

export function mainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Задать вопрос', 'action:ask')
    .row()
    .text('Мои отчёты', 'action:reports')
    .text('Тарифы', 'action:tariff')
}

export function analyzeAgain(): InlineKeyboard {
  return new InlineKeyboard().text('Ещё вопрос', 'action:ask').row().text('Тарифы', 'action:tariff')
}
