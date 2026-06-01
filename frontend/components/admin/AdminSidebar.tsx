"use client"

import { ADMIN_NAV_GROUPS } from "@/lib/admin-nav"
import { ADMIN_STORAGE_KEY } from "@/lib/admin"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Menu, Snowflake, X } from "lucide-react"
import { useState } from "react"

type AdminSidebarProps = {
  onLogout?: () => void
}

export function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const logout = () => {
    try {
      localStorage.removeItem(ADMIN_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    onLogout?.()
    router.push("/admin")
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-card rounded-lg shadow-md border border-border"
        aria-label="Открыть меню"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {mobileOpen ? (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/50 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={`
        fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-50 flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
          <Link href="/admin" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Snowflake className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-foreground">Frosty</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Admin
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 hover:bg-secondary rounded"
            aria-label="Закрыть меню"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href))
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={item.description}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                        transition-colors duration-200
                        ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 p-4 border-t border-border space-y-1">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Выйти из админки
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            На сайт
          </Link>
        </div>
      </aside>
    </>
  )
}
