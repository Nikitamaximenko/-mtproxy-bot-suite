import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Frosty Admin — Панель управления',
  description: 'Административная панель управления Frosty Proxy',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-secondary/30">
      {children}
    </div>
  )
}
