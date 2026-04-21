import type { LogikaContext } from '../bot.js'
import { canUseVoice } from '../../../shared/tariffs.js'
import { upgradeToUltraKeyboard } from '../keyboards/tariffs.js'
import { transcribeVoice } from '../services/transcriber.js'

export async function voiceHandler(ctx: LogikaContext): Promise<void> {
  if (!canUseVoice(ctx.session.tier)) {
    await ctx.reply(
      'Голосовые сообщения — только в тарифе ULTRA. Обновить?',
      { reply_markup: upgradeToUltraKeyboard() },
    )
    return
  }

  const voice = ctx.message?.voice
  if (!voice) return

  try {
    const file = await ctx.api.getFile(voice.file_id)
    const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`
    const transcript = await transcribeVoice(url)
    ctx.session.voiceSecondsUsedThisMonth += voice.duration

    // The next step of the conversation will read this as user input.
    // For now we just echo recognition so user can confirm/edit.
    await ctx.reply(`Распознал:\n\n_${transcript}_`, { parse_mode: 'Markdown' })
  } catch (err) {
    await ctx.reply('Не удалось распознать голосовое — попробуй ещё раз или отправь текстом.')
    console.error('voice error', err)
  }
}
