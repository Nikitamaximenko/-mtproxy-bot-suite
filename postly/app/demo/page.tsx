import { Composer } from "@/app/app/composer"
import { MOCK_ACCOUNTS } from "@/lib/mock-accounts"

export default function DemoPage() {
  return <Composer accounts={MOCK_ACCOUNTS} isDemo />
}
