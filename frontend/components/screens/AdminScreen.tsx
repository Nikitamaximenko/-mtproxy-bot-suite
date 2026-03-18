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
  ChevronRight,
  Snowflake,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react"
import { cn } from "@/lib/utils"

const stats = [
  { label: "Пользователи", value: "2,847", change: "+12%", up: true, icon: Users, color: "#0099ff" },
  { label: "Выручка", value: "849K ₽", change: "+23%", up: true, icon: DollarSign, color: "#00ff88" },
  { label: "Активные", value: "1,892", change: "+8%", up: true, icon: Activity, color: "#ffcc00" },
  { label: "Конверсия", value: "12.4%", change: "-2%", up: false, icon: TrendingUp, color: "#ff66cc" },
]

const users = [
  { id: 1, name: "Иван П.", email: "ivan@mail.ru", status: "active", plan: "299₽", date: "15 мар 2026", avatar: "И" },
  { id: 2, name: "Анна С.", email: "anna@gmail.com", status: "active", plan: "299₽", date: "14 мар 2026", avatar: "А" },
  { id: 3, name: "Сергей К.", email: "sergey@yandex.ru", status: "expired", plan: "299₽", date: "10 мар 2026", avatar: "С" },
  { id: 4, name: "Елена М.", email: "elena@mail.ru", status: "active", plan: "299₽", date: "12 мар 2026", avatar: "Е" },
  { id: 5, name: "Дмитрий В.", email: "dmitry@gmail.com", status: "active", plan: "299₽", date: "11 мар 2026", avatar: "Д" },
]

export function AdminScreen() {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#0066cc]/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#00ccff]/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 px-5 py-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066cc] to-[#00ccff] flex items-center justify-center">
              <Snowflake className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Админ-панель</h1>
              <p className="text-sm text-white/40">Frosty Dashboard</p>
            </div>
          </div>
          <button className="flex items-center gap-2 text-sm font-medium text-white bg-white/5 border border-white/10 px-5 py-3 rounded-xl hover:bg-white/10 transition-colors">
            <Download className="w-4 h-4" />
            Экспорт
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => {
            const Icon = stat.icon
            return (
              <div 
                key={i} 
                className="relative rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-5 backdrop-blur-xl overflow-hidden"
              >
                {/* Colored glow */}
                <div 
                  className="absolute -top-10 -right-10 w-20 h-20 rounded-full blur-2xl opacity-30"
                  style={{ backgroundColor: stat.color }}
                />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div 
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${stat.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: stat.color }} />
                    </div>
                    <span className={cn(
                      "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                      stat.up 
                        ? "bg-[#00ff88]/10 text-[#00ff88]" 
                        : "bg-[#ff4444]/10 text-[#ff4444]"
                    )}>
                      {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {stat.change}
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Users List */}
        <div className="rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 backdrop-blur-xl overflow-hidden">
          {/* Search Header */}
          <div className="p-5 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                type="text"
                placeholder="Поиск пользователей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#0066cc]/50 transition-colors"
              />
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider px-5 py-4">Пользователь</th>
                  <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider px-5 py-4">Статус</th>
                  <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider px-5 py-4">Тариф</th>
                  <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider px-5 py-4">Дата</th>
                  <th className="text-right text-xs font-medium text-white/40 uppercase tracking-wider px-5 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066cc]/30 to-[#00ccff]/30 flex items-center justify-center text-sm font-semibold text-white">
                          {user.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.name}</p>
                          <p className="text-xs text-white/40">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full",
                          user.status === "active"
                            ? "bg-[#00ff88]/10 text-[#00ff88]"
                            : "bg-[#ff4444]/10 text-[#ff4444]"
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            user.status === "active" ? "bg-[#00ff88]" : "bg-[#ff4444]"
                          )}
                        />
                        {user.status === "active" ? "Активен" : "Истёк"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-white/60">{user.plan}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-white/40">{user.date}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                        <MoreVertical className="w-4 h-4 text-white/40" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-white/5">
            {filteredUsers.map((user) => (
              <div key={user.id} className="p-4 flex items-center justify-between active:bg-white/5 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0066cc]/30 to-[#00ccff]/30 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                    {user.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          user.status === "active" ? "text-[#00ff88]" : "text-[#ff4444]"
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            user.status === "active" ? "bg-[#00ff88]" : "bg-[#ff4444]"
                          )}
                        />
                        {user.status === "active" ? "Активен" : "Истёк"}
                      </span>
                      <span className="text-xs text-white/30">{user.plan}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/20 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
