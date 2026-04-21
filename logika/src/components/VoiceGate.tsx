import { Mic, Lock } from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTier, canUseVoice, writeTier } from '../lib/tier'
import { VoiceDictateButton } from './VoiceDictateButton'

type Props = {
  onAppend: (text: string) => void
  disabled?: boolean
  className?: string
  showHint?: boolean
  compact?: boolean
}

const ease = [0.32, 0.72, 0, 1] as const

/**
 * Tier-aware voice input. For ULTRA — pass through to VoiceDictateButton.
 * For FREE/PRO — show a locked Mic that opens an upgrade modal. Voice is the
 * signature ULTRA feature; this gate makes that visible, not accidental.
 */
export function VoiceGate(props: Props) {
  const tier = useTier()
  const [open, setOpen] = useState(false)

  if (canUseVoice(tier)) {
    return <VoiceDictateButton {...props} />
  }

  const { disabled, className, compact, showHint } = props

  const btnClass = clsx(
    'ease-brand inline-flex items-center justify-center gap-2 rounded-[12px] border font-medium transition-all duration-300',
    compact ? 'h-12 w-12 shrink-0 p-0' : 'px-4 py-3 text-sm',
    'border-border bg-elevated text-dim hover:border-border-hover hover:text-muted',
    disabled && 'pointer-events-none opacity-40',
  )

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title="Голос — ULTRA"
        aria-label="Открыть апгрейд до ULTRA для голосового ввода"
        className={btnClass}
      >
        <Mic className="h-4 w-4" aria-hidden />
        {!compact && 'Голос'}
        <Lock className={compact ? 'absolute -right-1 -top-1 h-3 w-3' : 'h-3 w-3'} aria-hidden />
      </button>
      {showHint && !compact && (
        <span className="text-dim max-w-[220px] text-[11px] leading-snug">
          Голосовой ввод — только в тарифе ULTRA.
        </span>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.3, ease }}
              className="border-border bg-card relative w-full max-w-[420px] rounded-[16px] border p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-accent/15 text-accent mb-5 inline-flex h-10 w-10 items-center justify-center rounded-[10px]">
                <Mic className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-xl font-medium tracking-[-0.01em]">
                Голос — премиум фича ULTRA
              </h3>
              <p className="text-muted mt-3 text-[15px] leading-relaxed">
                Диктуй дилемму и ответы голосом. Серверная транскрипция, тонкая настройка под русский.
                Доступно только в тарифе ULTRA.
              </p>
              <ul className="text-muted mt-5 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-[2px]">✓</span> Голос вместо печати
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-[2px]">✓</span> Без лимита вопросов
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-[2px]">✓</span> История навсегда
                </li>
              </ul>
              <div className="mt-7 flex items-center justify-between">
                <span className="font-mono text-lg">
                  1 490 <span className="text-dim text-sm">₽/мес</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    writeTier('ultra')
                    setOpen(false)
                  }}
                  className="ease-brand bg-accent text-background hover:bg-accent-hover rounded-[4px] px-5 py-2.5 text-sm font-medium transition-all duration-300"
                >
                  Обновить до ULTRA →
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-dim hover:text-muted absolute right-4 top-4 text-sm"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
