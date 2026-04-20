import { Mic, Square } from 'lucide-react'
import { clsx } from 'clsx'
import { useSpeechDictation } from '../hooks/useSpeechDictation'

type Props = {
  /** Добавить распознанный фрагмент к полю */
  onAppend: (text: string) => void
  disabled?: boolean
  className?: string
  /** Короткая подпись под кнопкой на мобиле */
  showHint?: boolean
  /** Только иконка — для узкой строки (чат) */
  compact?: boolean
}

export function VoiceDictateButton({ onAppend, disabled, className, showHint, compact }: Props) {
  const { listening, error, setError, toggle, supported } = useSpeechDictation('ru-RU')

  const handleClick = () => {
    setError(null)
    toggle((text) => {
      onAppend(text)
    })
  }

  if (!supported) {
    return (
      <div className={clsx('text-dim text-left text-xs leading-snug', className)}>
        Голосовой ввод доступен в Chrome и Edge на компьютере и Android.
      </div>
    )
  }

  const btnClass = clsx(
    'ease-brand inline-flex items-center justify-center gap-2 rounded-[12px] border font-medium transition-all duration-300',
    compact ? 'h-12 w-12 shrink-0 p-0' : 'px-4 py-3 text-sm',
    listening
      ? 'border-accent bg-accent/15 text-accent animate-pulse'
      : 'border-border bg-elevated text-muted hover:border-border-hover hover:text-foreground',
    disabled && 'pointer-events-none opacity-40',
  )

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={listening ? 'Остановить запись' : 'Диктовать голосом'}
        aria-label={listening ? 'Остановить запись' : 'Диктовать голосом'}
        className={btnClass}
      >
        {listening ? (
          <>
            <Square className="h-4 w-4 fill-current" aria-hidden />
            {!compact && 'Стоп'}
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" aria-hidden />
            {!compact && 'Голосом'}
          </>
        )}
      </button>
      {showHint && (
        <span className="text-dim max-w-[220px] text-[11px] leading-snug">
          Нажми «Голосом», говори по-русски, снова нажми для остановки.
        </span>
      )}
      {error && <p className="text-danger max-w-xs text-xs leading-snug">{error}</p>}
    </div>
  )
}
