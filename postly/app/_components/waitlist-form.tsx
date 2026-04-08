"use client"

import { FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"

export function WaitlistForm() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source: typeof document !== "undefined" && document.referrer ? document.referrer : undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }

      if (!res.ok) {
        toast.error(data.error || "Что-то пошло не так")
        return
      }

      if (data.success) {
        setIsSubmitted(true)
        setEmail("")
      }
    } catch {
      toast.error("Сеть недоступна")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return <p className="text-base text-foreground">✓ Вы в списке. Спасибо!</p>
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="waitlist-email" className="sr-only">
          Email
        </label>
        <Input
          id="waitlist-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 min-h-12 text-base"
          disabled={isSubmitting}
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="h-12 min-h-12 shrink-0 px-6 text-base">
        {isSubmitting ? "…" : "Записаться"}
      </Button>
    </form>
  )
}
