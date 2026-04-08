import { auth } from "@/auth"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  return <>{children}</>
}
