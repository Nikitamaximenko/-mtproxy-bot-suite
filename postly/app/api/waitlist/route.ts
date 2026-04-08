import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const bodySchema = z.object({
  email: z.string().email("Некорректный email"),
  source: z.string().max(200, "Слишком длинный source").optional(),
})

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Ошибка валидации"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { email, source } = parsed.data

  try {
    await prisma.waitlistEntry.upsert({
      where: { email },
      create: { email, source: source ?? null },
      update: source !== undefined ? { source } : { email },
    })
  } catch {
    return NextResponse.json({ error: "Что-то пошло не так" }, { status: 500 })
  }

  console.log("[waitlist]", email, source ?? "(no source)")

  return NextResponse.json({ success: true })
}
