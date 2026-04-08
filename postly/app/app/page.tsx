import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function AppHomePage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <p className="text-center text-lg">
        Привет, {session.user.email ?? session.user.name ?? "пользователь"}! Composer будет здесь.
      </p>
    </main>
  )
}
