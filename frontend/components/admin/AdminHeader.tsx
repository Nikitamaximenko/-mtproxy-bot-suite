"use client"

import { Bell, Search } from "lucide-react"
import { useState } from "react"

interface AdminHeaderProps {
  title: string
  subtitle?: string
}

export function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  const [notifications] = useState(3)

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
      <div className="ml-12 lg:ml-0">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск..."
            className="bg-transparent border-none outline-none text-sm w-40 placeholder:text-muted-foreground"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 hover:bg-secondary rounded-lg transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {notifications > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
              {notifications}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
