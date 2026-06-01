"use client"

import { AdminHeader } from "@/components/admin/AdminHeader"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

type AdminPageChromeProps = {
  title: string
  subtitle?: string
  note?: string
  toolbar?: React.ReactNode
  onLogout?: () => void
  children: React.ReactNode
}

export function AdminPageChrome({
  title,
  subtitle,
  note,
  toolbar,
  onLogout,
  children,
}: AdminPageChromeProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar onLogout={onLogout} />
      <div className="flex-1 lg:ml-64 min-w-0">
        <AdminHeader title={title} subtitle={subtitle} note={note} />
        {toolbar ? (
          <div className="border-b border-border px-4 lg:px-6 py-2 flex flex-wrap items-center gap-2">
            {toolbar}
          </div>
        ) : null}
        <main className="p-4 lg:p-6 max-w-6xl">{children}</main>
      </div>
    </div>
  )
}
