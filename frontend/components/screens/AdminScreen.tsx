"use client"

import { useState } from "react"
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Activity,
  Search,
  MoreVertical,
  Download,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

const stats = [
  { label: "Пользователи", value: "1,234", change: "+12%", icon: Users },
  { label: "Доход", value: "245K ₽", change: "+8%", icon: DollarSign },
  { label: "Активные", value: "892", change: "+5%", icon: Activity },
  { label: "Конверсия", value: "7.2%", change: "+2%", icon: TrendingUp },
]

const users = [
  { id: 1, email: "ivan@mail.ru", status: "active", plan: "199₽", date: "15 мар 2026" },
  { id: 2, email: "anna@gmail.com", status: "active", plan: "199₽", date: "14 мар 2026" },
  { id: 3, email: "sergey@yandex.ru", status: "expired", plan: "199₽", date: "10 мар 2026" },
  { id: 4, email: "elena@mail.ru", status: "active", plan: "199₽", date: "12 мар 2026" },
  { id: 5, email: "dmitry@gmail.com", status: "active", plan: "199₽", date: "11 мар 2026" },
]

export function AdminScreen() {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-[calc(100vh-80px)] px-6 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Админ-панель</h1>
            <p className="text-sm text-muted-foreground mt-1">Управление подписками</p>
          </div>
          <button className="flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 px-4 py-2 rounded-xl">
            <Download className="w-4 h-4" />
            Экспорт
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {stats.map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={i} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            )
          })}
        </div>

        {/* Users List */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Поиск по email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-background border-border rounded-xl text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Email</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Статус</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Тариф</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Дата</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-foreground">{user.email}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
                          user.status === "active"
                            ? "bg-primary/10 text-primary"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            user.status === "active" ? "bg-primary" : "bg-destructive"
                          )}
                        />
                        {user.status === "active" ? "Активен" : "Истёк"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-muted-foreground">{user.plan}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-muted-foreground">{user.date}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-border">
            {filteredUsers.map((user) => (
              <div key={user.id} className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium",
                        user.status === "active" ? "text-primary" : "text-destructive"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          user.status === "active" ? "bg-primary" : "bg-destructive"
                        )}
                      />
                      {user.status === "active" ? "Активен" : "Истёк"}
                    </span>
                    <span className="text-xs text-muted-foreground">{user.date}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
