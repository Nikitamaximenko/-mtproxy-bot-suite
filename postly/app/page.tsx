import { LandingHero } from "./_components/landing-hero"
import { WaitlistForm } from "./_components/waitlist-form"

export default function Home() {
  return (
    <main className="bg-background text-foreground">
      <LandingHero />

      <section className="border-t border-border px-4 py-16 md:py-24">
        <h2 className="mx-auto max-w-5xl text-center text-2xl font-semibold tracking-tight md:text-3xl">
          Зачем это нужно
        </h2>
        <div className="mx-auto mt-10 grid max-w-5xl gap-10 md:grid-cols-3 md:gap-8">
          <div>
            <p className="text-lg font-medium">30 минут стало 1 минутой</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Раньше вы открывали ВК, потом ТГ, потом ОК, копировали текст, загружали фото в каждую сеть. Теперь — один
              экран.
            </p>
          </div>
          <div>
            <p className="text-lg font-medium">С телефона, без компьютера</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Существующие сервисы рассчитаны на десктоп. Postly — мобильный с первого тапа.
            </p>
          </div>
          <div>
            <p className="text-lg font-medium">Только то, что нужно</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Никаких календарей, аналитики, отчётов и команд. Один экран, одна кнопка, один результат.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-16 md:py-24">
        <h2 className="mx-auto max-w-3xl text-center text-2xl font-semibold tracking-tight md:text-3xl">
          Сколько это стоит
        </h2>
        <div className="mx-auto mt-10 max-w-3xl text-center">
          <p className="text-5xl font-semibold tracking-tight md:text-6xl">299₽</p>
          <p className="mt-1 text-lg text-muted-foreground">в месяц</p>
          <p className="mt-6 text-base">или 2990₽ за год — два месяца в подарок</p>
          <p className="mx-auto mt-6 max-w-xl text-sm text-muted-foreground">
            На время раннего доступа — бесплатно. Цена закрепится за теми, кто оставит email сейчас.
          </p>
        </div>
      </section>

      <section id="waitlist" className="scroll-mt-4 border-t border-border px-4 py-16 md:py-24">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Получить ранний доступ</h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Оставьте email — пришлём ссылку как только запустим. Без спама.
          </p>
          <div className="mt-8 flex justify-center">
            <WaitlistForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Postly · 2026 · Связь: hello@postly.local
      </footer>
    </main>
  )
}
