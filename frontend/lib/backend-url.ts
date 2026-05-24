const VPS_BACKEND = "https://138-124-80-97.sslip.io:9443"

/** Production backend URL. Ignores stale Railway BACKEND_URL until Vercel env is updated. */
export function getBackendUrl(): string {
  const raw = (process.env.BACKEND_URL || VPS_BACKEND).replace(/\/+$/, "")
  if (raw.includes("railway.app") || raw.includes("localhost")) {
    return VPS_BACKEND
  }
  return raw
}
