"use client"

import { ADMIN_QUICK_LINKS } from "@/lib/admin-nav"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

type Props = {
  checkoutErrors24h?: number
  vpnProblems?: number
}

export function AdminQuickNav({ checkoutErrors24h, vpnProblems }: Props) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Куда перейти</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Раньше всё было одной длинной страницей. Теперь: сводка здесь, таблицы и инструменты — в разделах слева.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {ADMIN_QUICK_LINKS.map((item) => {
          const Icon = item.icon
          let badge: string | undefined
          if (item.href === "/admin/logs" && checkoutErrors24h && checkoutErrors24h > 0) {
            badge = `${checkoutErrors24h} ошибок за 24ч`
          }
          if (item.href === "/admin/users" && vpnProblems && vpnProblems > 0) {
            badge = `${vpnProblems} без VPN`
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  {badge ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
