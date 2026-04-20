import type { Bot } from 'grammy'
import type { LogikaContext } from '../bot.js'
import { canUseVoice } from '../../../shared/tariffs.js'
import { upgradeToUltraKeyboard } from '../keyboards/tariffs.js'
import { transcribeVoice } from '../services/transcriber.js'

export function registerVoiceHandler(bot: Bot<LogikaContext>) {
  bot.on('message:voice', async (ctx) => {
    const tier = ctx.session.tier
    if (!canUseVoice(tier)) {
      await ctx.reply(
        [
          '*Голосовые — в тарифе ULTRA.*',
          '',
          'Распознаём до 30 минут в месяц. Удобно ночью, в дороге, когда писать лень — а решать надо.',
        ].join('\n'),
        { parse_mode: 'Markdown', reply_markup: upgradeToUltraKeyboard() },
      )
      return
    }

    const durationSec = ctx.message.voice.duration
    const file = await ctx.getFile()
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`

    await ctx.reply('Слушаю запись…')
    const text = await transcribeVoice(fileUrl)

    ctx.session.voiceSecondsUsedThisMonth += durationSec

    await ctx.reply(
      [`_Распознано:_`, '', text, '', `_${durationSec} сек · ULTRA_`].join('\n'),
      { parse_mode: 'Markdown' },
    )

    // NOTE: the transcribed text should be re-injected into the active
    // conversation. This requires grammY external helpers — see dialog.ts
    // for the integration point. Leaving TODO here on purpose, as integration
    // depends on whether we use conversations or custom state machine.
  })
}
