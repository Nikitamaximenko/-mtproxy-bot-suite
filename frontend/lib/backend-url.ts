const VPS_BACKEND = "https://138-124-80-97.sslip.io:9443"
const RAILWAY_BACKEND = "https://mtproxy-bot-suite-production.up.railway.app"

/** Production backend URL (primary VPS). */
export function getBackendUrl(): string {
  if (process.env.BACKEND_FORCE_RAILWAY === "1" || process.env.BACKEND_FORCE_RAILWAY === "true") {
    return RAILWAY_BACKEND
  }
  const raw = (process.env.BACKEND_URL || VPS_BACKEND).replace(/\/+$/, "")
  if (raw.includes("localhost")) {
    return raw
  }
  if (raw.includes("railway.app")) {
    return raw
  }
  return raw || VPS_BACKEND
}

export function getRailwayBackendUrl(): string {
  return RAILWAY_BACKEND
}

export function getVpsBackendUrl(): string {
  return VPS_BACKEND
}

/** VPS first, Railway fallback (read-only safe paths / health). */
export async function fetchBackendWithFailover(
  path: string,
  init?: RequestInit,
  timeoutMs = 5000,
): Promise<Response> {
  const bases = [getVpsBackendUrl(), getRailwayBackendUrl()]
  let lastError: unknown
  for (const base of bases) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      })
      return res
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All backends unreachable")
}
