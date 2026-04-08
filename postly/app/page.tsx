import Link from "next/link"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-center text-xl font-semibold text-foreground sm:text-2xl">
        Postly — постинг в соцсети РФ за минуту
      </h1>
      <Link
        href="/login"
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Попробовать
      </Link>
    </main>
  )
}
