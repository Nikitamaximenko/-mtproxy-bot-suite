"use client"

interface AdminHeaderProps {
  title: string
  subtitle?: string
  note?: string
}

export function AdminHeader({ title, subtitle, note }: AdminHeaderProps) {
  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
      <div className="ml-12 lg:ml-0">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      {note ? <div className="text-xs text-muted-foreground">{note}</div> : null}
    </header>
  )
}
