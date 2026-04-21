import { InlineKeyboard } from 'grammy'

export function tariffKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('FREE', 'tariff:free')
    .text('PRO — 790 ₽', 'tariff:pro')
    .row()
    .text('ULTRA — 1 490 ₽ · голос', 'tariff:ultra')
}

export function upgradeToUltraKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('Оплатить звёздами', 'upgrade:ultra')
}
