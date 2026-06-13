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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm text-white/70">
          Автоматические drip/push с <b className="text-white">A/B</b>: варианты распределяются стабильно по
          пользователям. Статистика: отправки, клики (кнопка 📊), конверсия в оплату. Тексты можно сгенерировать через
          OpenRouter на бэкенде.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/80">Кампании</h3>
          {loading && <p className="text-sm text-white/50">Загрузка…</p>}
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                selectedId === c.id
                  ? "border-cyan-400/40 bg-cyan-500/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-white/80 hover:bg-white/[0.05]"
              }`}
            >
              <div className="font-medium">{c.name}</div>
              <div className="mt-1 text-xs text-white/50">
                {STATUS_LABELS[c.status] || c.status} · {formatNumber(c.total_sent)} отпр. · {c.variants_count} A/B
              </div>
            </button>
          ))}
        </div>

        {detail && stats && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{detail.campaign.name}</h2>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">{detail.campaign.slug}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">{detail.campaign.kind}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["active", "paused", "draft"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={busy || detail.campaign.status === st}
                  onClick={() => void patchStatus(st)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/90 disabled:opacity-40"
                >
                  {STATUS_LABELS[st]}
                </button>
              ))}
              {detail.campaign.kind === "push" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runPush()}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Запустить push
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/50">
                    <th className="p-2">Вар.</th>
                    <th className="p-2">Отпр.</th>
                    <th className="p-2">CTR</th>
                    <th className="p-2">Конв.</th>
                    <th className="p-2">Текст</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.variants.map((v) => (
                    <tr key={v.variant_id} className="border-b border-white/5 text-white/85">
                      <td className="p-2 font-mono">
                        {v.variant_key}
                        {v.is_ai_generated ? " ✨" : ""}
                      </td>
                      <td className="p-2">{formatNumber(v.sent)}</td>
                      <td className="p-2">{v.ctr_pct}%</td>
                      <td className="p-2">{v.conversion_pct}%</td>
                      <td className="p-2 max-w-xs truncate text-white/60">{v.message_preview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-medium text-white">Автогенерация (OpenRouter)</h3>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
                placeholder="Промпт для ИИ: тон, УТП, ограничения…"
                className="w-full rounded-lg border border-white/15 bg-black/30 p-2 text-sm text-white"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void generateVariants(false)}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  +2 варианта (ИИ)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void generateVariants(true)}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80 disabled:opacity-50"
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
    <div className="rounded-xl border border-white/10 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm text-white">
        <span className="font-mono font-bold">Вариант {variant.variant_key}</span>
        {variant.is_ai_generated && <span className="text-xs text-violet-300">AI</span>}
        <label className="ml-auto flex items-center gap-1 text-xs text-white/60">
          вес
          <input
            type="number"
            min={1}
            max={100}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-14 rounded border border-white/15 bg-black/30 px-1 py-0.5 text-white"
          />
        </label>
      </div>
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        rows={5}
        className="w-full rounded-lg border border-white/15 bg-black/30 p-2 font-mono text-xs text-white"
      />
      <p className="text-xs text-white/45">Плейсхолдеры: {"{greeting}"}, {"{price}"}, {"{ref_line}"}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSave(msg, weight)}
        className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white disabled:opacity-40"
      >
        Сохранить
      </button>
    </div>
  )
}
