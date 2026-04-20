/**
 * TypeScript `lib.dom` включает события Web Speech API, но не конструктор
 * `SpeechRecognition` — он есть в Chrome/Edge как `SpeechRecognition` / `webkitSpeechRecognition`.
 */
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null
  onend: ((this: SpeechRecognition, ev: Event) => unknown) | null
  start(): void
  stop(): void
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition
  new (): SpeechRecognition
}

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition
  new (): SpeechRecognition
}
