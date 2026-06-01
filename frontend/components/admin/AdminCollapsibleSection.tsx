"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { useEffect, useState } from "react"

type AdminCollapsibleSectionProps = {
  id: string
  title: string
  summary?: string
  defaultOpen?: boolean
  badge?: string | number
  children: React.ReactNode
}

export function AdminCollapsibleSection({
  id,
  title,
  summary,
  defaultOpen = false,
  badge,
  children,
}: AdminCollapsibleSectionProps) {
  const storageKey = `frosty_admin_section_${id}`
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === "1") setOpen(true)
      if (stored === "0") setOpen(false)
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    try {
      localStorage.setItem(storageKey, next ? "1" : "0")
    } catch {
      /* ignore */
    }
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border border-gray-800 rounded-2xl bg-gray-900/60 overflow-hidden"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-gray-800/50 transition-colors">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
            {badge != null && badge !== "" ? (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                {badge}
              </span>
            ) : null}
          </div>
          {summary && !open ? (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{summary}</p>
          ) : null}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 pt-1 border-t border-gray-800/80 space-y-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
