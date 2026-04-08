"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await signIn("nodemailer", {
        email: email.trim(),
        redirect: false,
        redirectTo: "/app",
      })
      if (res?.error) {
        setError(res.error)
        return
      }
      window.location.href = "/login/check-email"
    } catch {
      setError("Не удалось отправить запрос")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-muted-foreground">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-[44px] rounded-lg border border-input bg-background px-3 text-foreground"
          placeholder="you@example.com"
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Отправка…" : "Получить ссылку"}
      </button>
    </form>
  )
}
