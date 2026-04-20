import { useCallback, useEffect, useRef, useState } from 'react'

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function speechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null
}

/**
 * Диктовка в текст (Chrome / Edge; на iOS Safari обычно недоступно).
 * Добавляет только финальные фрагменты — стабильнее, чем подмена interim.
 */
export function useSpeechDictation(lang = 'ru-RU') {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognition | null>(null)

  const stop = useCallback(() => {
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    recRef.current = null
    setListening(false)
  }, [])

  useEffect(() => () => stop(), [stop])

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = getRecognitionCtor()
      if (!Ctor) {
        setError('Голосовой ввод недоступен в этом браузере. Попробуйте Chrome или Edge.')
        return
      }
      setError(null)
      stop()

      const recognition = new Ctor()
      recognition.lang = lang
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i]
          if (res.isFinal) {
            const t = res[0]?.transcript?.trim()
            if (t) onFinal(t)
          }
        }
      }

      recognition.onerror = (ev: SpeechRecognitionErrorEvent) => {
        if (ev.error === 'aborted' || ev.error === 'no-speech') return
        if (ev.error === 'not-allowed') {
          setError('Нужен доступ к микрофону в настройках браузера.')
        } else {
          setError(`Ошибка распознавания: ${ev.error}`)
        }
        setListening(false)
        recRef.current = null
      }

      recognition.onend = () => {
        setListening(false)
        recRef.current = null
      }

      recRef.current = recognition
      setListening(true)
      try {
        recognition.start()
      } catch {
        setError('Не удалось запустить распознавание речи.')
        setListening(false)
        recRef.current = null
      }
    },
    [lang, stop],
  )

  const toggle = useCallback(
    (onFinal: (text: string) => void) => {
      if (listening) {
        stop()
        return
      }
      start(onFinal)
    },
    [listening, start, stop],
  )

  return {
    listening,
    error,
    setError,
    start,
    stop,
    toggle,
    supported: speechRecognitionSupported(),
  }
}
