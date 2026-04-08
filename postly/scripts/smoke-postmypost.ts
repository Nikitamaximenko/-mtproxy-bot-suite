import { resolve } from "path"
import { config } from "dotenv"
import { getChannels } from "../lib/postmypost"

config({ path: resolve(process.cwd(), ".env.local") })

async function main() {
  console.log("→ Postmypost smoke test")
  console.log("  base URL:", process.env.POSTMYPOST_API_BASE_URL)
  console.log("  token:", process.env.POSTMYPOST_API_TOKEN ? "present" : "MISSING")
  console.log()

  try {
    console.log("→ Fetching channels...")
    const channels = await getChannels()
    console.log(`✓ Got ${channels.length} channels`)
    console.log(JSON.stringify(channels, null, 2))
  } catch (err) {
    console.error("✗ Error:", err)
    if (err && typeof err === "object" && "status" in err) {
      console.error("  status:", (err as { status: unknown }).status)
      console.error("  body:", (err as { body?: unknown }).body)
    }
    process.exit(1)
  }
}

main()
