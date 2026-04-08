import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const text = formData.get("text") as string
  const accountIdsRaw = formData.get("accountIds") as string
  const accountIds = JSON.parse(accountIdsRaw) as number[]
  const files = formData.getAll("files").filter((v): v is File => v instanceof File)

  console.log("[publish] user:", session.user.email)
  console.log("[publish] text:", text)
  console.log("[publish] accountIds:", accountIds)
  console.log(
    "[publish] files:",
    files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
  )

  await new Promise((r) => setTimeout(r, 800))

  return NextResponse.json({ success: true, publicationId: "mock-" + Date.now() })
}
