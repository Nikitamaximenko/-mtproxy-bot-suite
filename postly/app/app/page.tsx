import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Composer } from "./composer"
import { MOCK_ACCOUNTS } from "@/lib/mock-accounts"

export default async function AppHomePage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  return <Composer accounts={MOCK_ACCOUNTS} />
}
