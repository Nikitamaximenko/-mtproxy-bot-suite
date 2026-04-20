import type { Subscription, Tier } from '../../../shared/types.js'

/**
 * Unified billing facade. Selects provider by input and returns a consistent
 * subscription object. All providers mutate subscription through the same
 * activateSubscription() entry.
 *
 * Providers:
 *   - telegram-stars: fully handled inside grammY handlers/billing.ts
 *   - lava          : card payments (RU), webhook lands in backend/webhook/lava
 *   - prodamus      : fallback, webhook at /webhook/prodamus (see root backend)
 */
export async function activateSubscription(
  userId: string,
  tier: Tier,
  provider: Subscription['provider'],
  months: number,
): Promise<Subscription> {
  const now = new Date()
  const activeUntil = new Date(now)
  activeUntil.setMonth(activeUntil.getMonth() + months)
  return {
    userId,
    tier,
    activeUntil: activeUntil.toISOString(),
    provider,
    recurring: true,
  }
}

export async function checkLava(_userId: string): Promise<boolean> {
  // TODO: query backend for current Lava subscription state.
  return false
}
