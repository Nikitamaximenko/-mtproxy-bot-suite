import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function LandingHero() {
  return (
    <section className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
        Постинг во все соцсети — за минуту
      </h1>
      <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground md:text-lg">
        ВКонтакте, Telegram, Одноклассники, Rutube. С телефона. Без десктопа, без сложных кабинетов, без обучения.
      </p>
      <div className="mt-8 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link
          href="#waitlist"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "h-14 min-h-14 justify-center px-8 text-base font-medium"
          )}
        >
          Получить ранний доступ
        </Link>
        <Link
          href="/demo"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-14 min-h-14 justify-center px-8 text-base font-medium"
          )}
        >
          Посмотреть как работает
        </Link>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">299₽/мес после запуска. Сейчас бесплатно.</p>
    </section>
  )
}
