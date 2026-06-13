"use client"

import {
  AdminAuthError,
  CampaignDetail,
  CampaignListItem,
  CampaignStats,
  fetchAdminJson,
  formatNumber,
} from "@/lib/admin"
import { useCallback, useEffect, useState } from "react"

const ADMIN_TEST_TG_ID = 231115635

type AdminCampaignsPanelProps = {
  adminKey: string
  onError: (err: unknown) => void
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  active: "Активна",
  paused: "Пауза",
  archived: "Архив",
}

const KIND_LABELS: Record<string, string> = {
  drip: "Drip (авто)",
  push: "Push (вручную)",
  lifecycle: "Lifecycle",
}

export function AdminCampaignsPanel({ adminKey, onError }: AdminCampaignsPanelProps) {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<CampaignDetail | null>(null)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [notice, setNotice] = useState("")

  const handleErr = useCallback(
    (err: unknown) => {
      if (err instanceof AdminAuthError) {
        onError(err)
        return true
      }
      onError(err)
      return false
    },
    [onError],
  )

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminJson<{ campaigns: CampaignListItem[] }>("/api/admin/campaigns", adminKey)
      setCampaigns(data.campaigns)
      setSelectedId((prev) => {
        if (prev != null && data.campaigns.some((c) => c.id === prev)) return prev
        return data.campaigns[0]?.id ?? null
      })
    } catch (e) {
      handleErr(e)
    } finally {
      setLoading(false)
    }
  }, [adminKey, handleErr])

  const loadDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true)
      setStats(null)
      try {
        const d = await fetchAdminJson<CampaignDetail>(`/api/admin/campaigns/${id}`, adminKey)
        setDetail(d)
        setAiPrompt(d.ai_prompt || "")
        try {
          const s = await fetchAdminJson<CampaignStats>(`/api/admin/campaigns/${id}/stats`, adminKey)
          setStats(s)
        } catch (statsErr) {
          handleErr(statsErr)
        }
      } catch (e) {
        setDetail(null)
        handleErr(e)
      } finally {
        setDetailLoading(false)
      }
    },
    [adminKey, handleErr],
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
    setNotice("")
    try {
      await fetchAdminJson(`/api/admin/campaigns/${selectedId}`, adminKey, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      setNotice(`Статус изменён: ${STATUS_LABELS[status] || status}`)
      await loadList()
      await loadDetail(selectedId)
    } catch (e) {
      handleErr(e)
    } finally {
      setBusy(false)
    }
  }

  const generateVariants = async (replace: boolean) => {
    if (selectedId == null) return
    if (detail && detail.ai_available === false) {
      onError("На VPS не задан OPENROUTER_API_KEY — автогенерация недоступна")
      return
    }
    setBusy(true)
    setNotice("")
    try {
      await fetchAdminJson(`/api/admin/campaigns/${selectedId}/generate-variants`, adminKey, {
        method: "POST",
        body: JSON.stringify({
          count: 2,
          prompt: aiPrompt.trim() || undefined,
          replace_existing: replace,
        }),
      })
      setNotice("Варианты сгенерированы")
      await loadDetail(selectedId)
      await loadList()
    } catch (e) {
      handleErr(e)
    } finally {
      setBusy(false)
    }
  }

  const saveVariant = async (variantId: number, message_html: string, weight: number) => {
    setBusy(true)
    setNotice("")
    try {
      await fetchAdminJson(`/api/admin/campaigns/variants/${variantId}`, adminKey, {
        method: "PATCH",
        body: JSON.stringify({ message_html, weight }),
      })
      setNotice("Вариант сохранён")
      if (selectedId != null) await loadDetail(selectedId)
    } catch (e) {
      handleErr(e)
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    if (selectedId == null) return
    setBusy(true)
    setNotice("")
    try {
      const res = await fetchAdminJson<{ ok: boolean; variant_key: string; telegram_id: number }>(
        `/api/admin/campaigns/${selectedId}/send-test`,
        adminKey,
        { method: "POST", body: JSON.stringify({ telegram_id: ADMIN_TEST_TG_ID }) },
      )
      setNotice(`Тест отправлен в Telegram (${res.telegram_id}), вариант ${res.variant_key}`)
      if (selectedId != null) await loadDetail(selectedId)
      await loadList()
    } catch (e) {
      handleErr(e)
    } finally {
      setBusy(false)
    }
  }

  const runPush = async () => {
    if (selectedId == null) return
    if (!confirm("Запустить push-кампанию сейчас?")) return
    setBusy(true)
    setNotice("")
    try {
      const res = await fetchAdminJson<{ sent: number }>(
        `/api/admin/campaigns/${selectedId}/run-push`,
        adminKey,
        { method: "POST", body: "{}" },
      )
      setNotice(`Push отправлен: ${res.sent} сообщений`)
      await loadDetail(selectedId)
      await loadList()
    } catch (e) {
      handleErr(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
        <p className="text-sm text-foreground leading-relaxed">
          <strong>Drip</strong> — уходит автоматически раз в час по триггеру (например, +2ч после регистрации).
          <strong className="ml-1">Push</strong> — только по кнопке «Запустить push».
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A/B распределяется стабильно по пользователям. Статистика: отправки, клики, конверсия в оплату.
          Кнопка «Тест мне» шлёт сообщение в ваш Telegram для проверки.
        </p>
      </div>

      {notice ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_1fr]">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Кампании</h3>
          {loading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
          {!loading && campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Кампаний нет — перезапустите бэкенд для seed.</p>
          ) : null}
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
                {STATUS_LABELS[c.status] || c.status} · {KIND_LABELS[c.kind] || c.kind} ·{" "}
                {formatNumber(c.total_sent)} отпр.
              </div>
            </button>
          ))}
        </div>

        <div className="min-w-0">
          {detailLoading && <p className="text-sm text-muted-foreground">Загрузка кампании…</p>}

          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{detail.campaign.name}</h2>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground font-mono">
                  {detail.campaign.slug}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground">
                  {KIND_LABELS[detail.campaign.kind] || detail.campaign.kind}
                </span>
                {detail.campaign.trigger_offset_minutes != null ? (
                  <span className="text-xs text-muted-foreground">
                    триггер +{detail.campaign.trigger_offset_minutes} мин
                  </span>
                ) : null}
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
                    {detail.campaign.status === st ? " ✓" : ""}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendTest()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Тест мне
                </button>
                {detail.campaign.kind === "push" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runPush()}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    Запустить push
                  </button>
                ) : null}
              </div>

              {stats ? (
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
              ) : (
                <p className="text-sm text-muted-foreground">Статистика недоступна</p>
              )}

              <div className="space-y-3 rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-medium text-foreground">Автогенерация (OpenRouter)</h3>
                {detail.ai_available === false ? (
                  <p className="text-sm text-destructive">
                    OPENROUTER_API_KEY не задан на бэкенде — добавьте в `/opt/frostyvpn/backend/.env` и перезапустите
                    сервис.
                  </p>
                ) : null}
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
                    disabled={busy || detail.ai_available === false}
                    onClick={() => void generateVariants(false)}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    +2 варианта (ИИ)
                  </button>
                  <button
                    type="button"
                    disabled={busy || detail.ai_available === false}
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
        {variant.is_ai_generated ? (
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">AI</span>
        ) : null}
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
