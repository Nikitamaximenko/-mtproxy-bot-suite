"use client"

import {
  CampaignDetail,
  CampaignListItem,
  CampaignStats,
  fetchAdminJson,
  formatNumber,
} from "@/lib/admin"
import { useCallback, useEffect, useState } from "react"

type AdminCampaignsPanelProps = {
  adminKey: string
  onError: (msg: string) => void
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  active: "Активна",
  paused: "Пауза",
  archived: "Архив",
}

export function AdminCampaignsPanel({ adminKey, onError }: AdminCampaignsPanelProps) {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<CampaignDetail | null>(null)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminJson<{ campaigns: CampaignListItem[] }>("/api/admin/campaigns", adminKey)
      setCampaigns(data.campaigns)
      setSelectedId((prev) => prev ?? (data.campaigns[0]?.id ?? null))
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось загрузить кампании")
    } finally {
      setLoading(false)
    }
  }, [adminKey, onError])

  const loadDetail = useCallback(
    async (id: number) => {
      try {
        const [d, s] = await Promise.all([
          fetchAdminJson<CampaignDetail>(`/api/admin/campaigns/${id}`, adminKey),
          fetchAdminJson<CampaignStats>(`/api/admin/campaigns/${id}/stats`, adminKey),
        ])
        setDetail(d)
        setStats(s)
        setAiPrompt(d.ai_prompt || "")
      } catch (e) {
        onError(e instanceof Error ? e.message : "Не удалось загрузить кампанию")
      }
    },
    [adminKey, onError],
  )

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (selectedId != null) void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const patchStatus = async (status: string) => {
    if (selectedId == null) return
    setBusy(true)
    try {
      await fetchAdminJson(`/api/admin/campaigns/${selectedId}`, adminKey, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      await loadList()
      await loadDetail(selectedId)
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка обновления")
    } finally {
      setBusy(false)
    }
  }

  const generateVariants = async (replace: boolean) => {
    if (selectedId == null) return
    setBusy(true)
    try {
      await fetchAdminJson(`/api/admin/campaigns/${selectedId}/generate-variants`, adminKey, {
        method: "POST",
        body: JSON.stringify({
          count: 2,
          prompt: aiPrompt.trim() || undefined,
          replace_existing: replace,
        }),
      })
      await loadDetail(selectedId)
      await loadList()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Автогенерация не удалась (нужен OPENROUTER_API_KEY на бэкенде)")
    } finally {
      setBusy(false)
    }
  }

  const saveVariant = async (variantId: number, message_html: string, weight: number) => {
    setBusy(true)
    try {
      await fetchAdminJson(`/api/admin/campaigns/variants/${variantId}`, adminKey, {
        method: "PATCH",
        body: JSON.stringify({ message_html, weight }),
      })
      if (selectedId != null) await loadDetail(selectedId)
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось сохранить вариант")
    } finally {
      setBusy(false)
    }
  }

  const runPush = async () => {
    if (selectedId == null) return
    if (!confirm("Запустить push-кампанию сейчас?")) return
    setBusy(true)
    try {
      const res = await fetchAdminJson<{ sent: number }>(
        `/api/admin/campaigns/${selectedId}/run-push`,
        adminKey,
        { method: "POST", body: "{}" },
      )
      alert(`Отправлено: ${res.sent}`)
      await loadDetail(selectedId)
      await loadList()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Push не запустился")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Автоматические drip/push с <strong className="text-foreground">A/B</strong>: варианты распределяются
          стабильно по пользователям. Статистика: отправки, клики (кнопка 📊), конверсия в оплату. Тексты можно
          сгенерировать через OpenRouter на бэкенде.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_1fr]">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Кампании</h3>
          {loading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                selectedId === c.id
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                  : "border-border bg-card text-foreground hover:bg-secondary/60"
              }`}
            >
              <div className="font-medium leading-snug">{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {STATUS_LABELS[c.status] || c.status} · {formatNumber(c.total_sent)} отпр. · {c.variants_count} A/B
              </div>
            </button>
          ))}
        </div>

        {detail && stats && (
          <div className="space-y-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{detail.campaign.name}</h2>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground font-mono">
                {detail.campaign.slug}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {detail.campaign.kind}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["active", "paused", "draft"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={busy || detail.campaign.status === st}
                  onClick={() => void patchStatus(st)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-40"
                >
                  {STATUS_LABELS[st]}
                </button>
              ))}
              {detail.campaign.kind === "push" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runPush()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Запустить push
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Вар.</th>
                    <th className="p-3 font-medium">Отпр.</th>
                    <th className="p-3 font-medium">CTR</th>
                    <th className="p-3 font-medium">Конв.</th>
                    <th className="p-3 font-medium">Текст</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.variants.map((v) => (
                    <tr key={v.variant_id} className="border-b border-border/60 text-foreground">
                      <td className="p-3 font-mono font-semibold">
                        {v.variant_key}
                        {v.is_ai_generated ? " ✨" : ""}
                      </td>
                      <td className="p-3">{formatNumber(v.sent)}</td>
                      <td className="p-3">{v.ctr_pct}%</td>
                      <td className="p-3">{v.conversion_pct}%</td>
                      <td className="p-3 max-w-xs text-muted-foreground text-xs leading-relaxed">
                        {stripHtml(v.message_preview)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium text-foreground">Автогенерация (OpenRouter)</h3>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
                placeholder="Промпт для ИИ: тон, УТП, ограничения…"
                className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm resize-y"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void generateVariants(false)}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  +2 варианта (ИИ)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void generateVariants(true)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Заменить все варианты
                </button>
              </div>
            </div>

            {detail.variants.map((v) => (
              <VariantEditor
                key={v.id}
                variant={v}
                disabled={busy}
                onSave={(msg, w) => void saveVariant(v.id, msg, w)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function VariantEditor({
  variant,
  disabled,
  onSave,
}: {
  variant: { variant_key: string; message_html: string; weight: number; is_ai_generated: boolean }
  disabled: boolean
  onSave: (message: string, weight: number) => void
}) {
  const [msg, setMsg] = useState(variant.message_html)
  const [weight, setWeight] = useState(variant.weight)

  useEffect(() => {
    setMsg(variant.message_html)
    setWeight(variant.weight)
  }, [variant.message_html, variant.weight])

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          Вариант <span className="font-mono">{variant.variant_key}</span>
        </span>
        {variant.is_ai_generated && (
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">AI</span>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          вес
          <input
            type="number"
            min={1}
            max={100}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-16 px-2 py-1 rounded-lg border border-border bg-secondary text-foreground text-sm"
          />
        </label>
      </div>

      <div className="rounded-lg bg-secondary/70 border border-border px-3 py-2 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        <span className="text-xs text-muted-foreground block mb-1">Как увидит пользователь (примерно):</span>
        {stripHtml(msg.replace("{greeting}", "Алексей").replace("{price}", "299").replace("{ref_line}", ""))}
      </div>

      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        rows={6}
        className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm leading-relaxed resize-y min-h-[140px]"
      />
      <p className="text-xs text-muted-foreground">
        Плейсхолдеры: <code className="text-foreground">{"{greeting}"}</code>,{" "}
        <code className="text-foreground">{"{price}"}</code>, <code className="text-foreground">{"{ref_line}"}</code>
        . HTML: <code className="text-foreground">&lt;b&gt;</code>, <code className="text-foreground">&lt;i&gt;</code>
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSave(msg, weight)}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-40"
      >
        Сохранить
      </button>
    </div>
  )
}
