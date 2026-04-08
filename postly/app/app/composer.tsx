"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CircleUser,
  MessageCircle,
  Newspaper,
  Paperclip,
  Play,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import type { ConnectedAccount } from "@/lib/mock-accounts"

function NetworkIcon({ network }: { network: ConnectedAccount["network"] }) {
  const className = "size-4 shrink-0"
  switch (network) {
    case "vk":
      return <Users className={className} aria-hidden />
    case "telegram":
      return <MessageCircle className={className} aria-hidden />
    case "odnoklassniki":
      return <CircleUser className={className} aria-hidden />
    case "rutube":
      return <Play className={className} aria-hidden />
    case "dzen":
      return <Newspaper className={className} aria-hidden />
    default:
      return <CircleUser className={className} aria-hidden />
  }
}

type ComposerProps = {
  accounts: ConnectedAccount[]
  isDemo?: boolean
}

export function Composer({ accounts, isDemo = false }: ComposerProps) {
  const ids = useMemo(() => accounts.map((a) => a.id), [accounts])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(ids))
  const [text, setText] = useState("")
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [isPublishing, setIsPublishing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setSelectedIds(new Set(ids))
  }, [ids])

  const previewUrls = useMemo(
    () => mediaFiles.map((f) => URL.createObjectURL(f)),
    [mediaFiles],
  )

  useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [previewUrls])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const focus = () => {
      if (mq.matches) textareaRef.current?.focus()
    }
    focus()
    mq.addEventListener("change", focus)
    return () => mq.removeEventListener("change", focus)
  }, [])

  const toggleChannel = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const removeFile = useCallback((index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const onFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    setMediaFiles((prev) => [...prev, ...Array.from(list)])
    e.target.value = ""
  }, [])

  const canPublish =
    (text.length > 0 || mediaFiles.length > 0) &&
    selectedIds.size > 0 &&
    !isPublishing

  async function onPublish() {
    if (!canPublish) return
    if (isDemo) {
      toast("Это демо. Зарегистрируйтесь чтобы публиковать по-настоящему")
      return
    }
    setIsPublishing(true)
    try {
      const formData = new FormData()
      formData.append("text", text)
      formData.append("accountIds", JSON.stringify(Array.from(selectedIds)))
      for (const file of mediaFiles) {
        formData.append("files", file)
      }

      const res = await fetch("/api/publish", { method: "POST", body: formData })
      const data = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        toast.error(data.error || "Не удалось опубликовать")
        return
      }

      toast.success("Опубликовано")
      setText("")
      setMediaFiles([])
    } catch {
      toast.error("Сеть недоступна")
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
        <p className="mb-2 text-xs text-muted-foreground">
          {selectedIds.size} из {accounts.length} выбрано
        </p>
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
          {accounts.map((acc) => {
            const on = selectedIds.has(acc.id)
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => toggleChannel(acc.id)}
                className={
                  on
                    ? "flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm text-muted-foreground"
                }
              >
                <NetworkIcon network={acc.network} />
                <span className="max-w-[9rem] truncate">{acc.name}</span>
              </button>
            )
          })}
        </div>

        <div className="relative flex min-h-[40vh] flex-1 flex-col sm:min-h-[50vh]">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="О чём расскажете?"
            className="min-h-[12rem] flex-1 resize-none border-0 bg-transparent p-0 text-lg shadow-none outline-none ring-0 focus-visible:border-transparent focus-visible:ring-0 md:min-h-[16rem]"
          />
          {text.length > 0 ? (
            <span className="pointer-events-none absolute bottom-0 right-0 text-xs text-muted-foreground">
              {text.length}
            </span>
          ) : null}
        </div>

        <div className="relative mt-2 pb-2">
          {mediaFiles.length > 0 ? (
            <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              {mediaFiles.map((file, i) => (
                <div
                  key={`${file.name}-${file.size}-${i}`}
                  className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted"
                >
                  {file.type.startsWith("video/") ? (
                    <video
                      src={previewUrls[i]}
                      className="size-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrls[i]}
                      alt=""
                      className="size-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-0.5 top-0.5 flex size-6 min-h-[24px] min-w-[24px] items-center justify-center rounded-full bg-foreground/80 text-background"
                    aria-label="Удалить вложение"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            onChange={onFilesChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Прикрепить файл"
          >
            <Paperclip className="size-6" />
          </button>
        </div>
      </div>

      <div
        className="sticky bottom-0 z-10 bg-background px-4 pt-2"
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <Button
          type="button"
          disabled={!canPublish}
          onClick={onPublish}
          className="h-14 min-h-14 w-full rounded-lg text-base font-medium"
        >
          {isPublishing ? "Публикуется..." : "Опубликовать"}
        </Button>
      </div>
    </div>
  )
}
