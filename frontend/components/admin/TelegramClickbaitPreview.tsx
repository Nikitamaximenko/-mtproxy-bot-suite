"use client"

type TelegramClickbaitPreviewProps = {
  messageHtml: string
  buttonText: string
  title: string
  templateKey: string
}

export function TelegramClickbaitPreview({
  messageHtml,
  buttonText,
  title,
  templateKey,
}: TelegramClickbaitPreviewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Шаблон {templateKey}
        </span>
        <span className="text-xs text-muted-foreground truncate">{title}</span>
      </div>
      <div className="rounded-2xl border border-border bg-[#0e1621] p-4 shadow-inner">
        <div className="max-w-[320px]">
          <div
            className="rounded-2xl rounded-tl-md bg-[#182533] px-4 py-3 text-[15px] leading-[1.45] text-white [&_b]:font-semibold"
            dangerouslySetInnerHTML={{ __html: messageHtml }}
          />
          <div className="mt-2 inline-flex max-w-full items-center rounded-xl bg-[#2b5278] px-4 py-2.5 text-sm font-medium text-[#6ab2f2]">
            {buttonText}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
          HTML для Telegram · кнопка с callback <code className="text-foreground/80">dbc:…:buy</code> →
          оплата в боте
        </p>
      </div>
    </div>
  )
}
