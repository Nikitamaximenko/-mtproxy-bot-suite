import { InlineKeyboard } from 'grammy'
import { TARIFFS, yearlyPrice, type Tier } from '../../../shared/tariffs.js'

export const tariffKeyboard = (current: Tier) => {
  const kb = new InlineKeyboard()
  ;(['FREE', 'PRO', 'ULTRA'] as const).forEach((t) => {
    const tag = current === t ? '✓ ' : ''
    const price = t === 'FREE' ? '0 ₽' : `${TARIFFS[t].monthlyRub} ₽/мес`
    kb.text(`${tag}${t} · ${price}`, `tariff:${t}`).row()
  })
  kb.text('Оплатить за год (−30%)', 'tariff:yearly').row()
  kb.url('Подробнее на сайте', 'https://logika.app/#tariffs')
  return kb
}

export const upgradeToUltraKeyboard = () =>
  new InlineKeyboard()
    .text(`Взять ULTRA · ${TARIFFS.ULTRA.monthlyRub} ₽/мес`, 'tariff:ULTRA')
    .row()
    .text(`За год · ${yearlyPrice('ULTRA').toLocaleString('ru-RU')} ₽`, 'tariff:ULTRA:yearly')
    .row()
    .text('Позже', 'tariff:dismiss')
