"use client"

import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminHeader } from "@/components/admin/AdminHeader"
import { 
  Users, 
  Server, 
  TrendingUp, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  Globe,
  Clock
} from "lucide-react"

// Mock data for demonstration
const stats = [
  { 
    label: "Активных пользователей", 
    value: "2,847", 
    change: "+12.5%", 
    trend: "up",
    icon: Users,
    color: "bg-primary"
  },
  { 
    label: "Серверов онлайн", 
    value: "12/12", 
    change: "100%", 
    trend: "up",
    icon: Server,
    color: "bg-success"
  },
  { 
    label: "Выручка (мес)", 
    value: "₽847,500", 
    change: "+8.2%", 
    trend: "up",
    icon: DollarSign,
    color: "bg-warning"
  },
  { 
    label: "Новых за неделю", 
    value: "156", 
    change: "-3.1%", 
    trend: "down",
    icon: TrendingUp,
    color: "bg-ice"
  },
]

const recentActivity = [
  { user: "user_7842", action: "Подключился к прокси", server: "EU-1", time: "2 мин назад" },
  { user: "user_3291", action: "Оплатил Premium", server: "-", time: "5 мин назад" },
  { user: "user_9103", action: "Подключился к прокси", server: "US-2", time: "8 мин назад" },
  { user: "user_1847", action: "Отключился", server: "EU-3", time: "12 мин назад" },
  { user: "user_5529", action: "Подключился к прокси", server: "EU-1", time: "15 мин назад" },
]

const serverStatus = [
  { name: "EU-1 Frankfurt", load: 78, users: 423, status: "online", latency: "12ms" },
  { name: "EU-2 Amsterdam", load: 45, users: 267, status: "online", latency: "18ms" },
  { name: "EU-3 London", load: 62, users: 341, status: "online", latency: "24ms" },
  { name: "US-1 New York", load: 34, users: 189, status: "online", latency: "89ms" },
  { name: "US-2 Los Angeles", load: 28, users: 156, status: "online", latency: "142ms" },
  { name: "AS-1 Singapore", load: 91, users: 512, status: "warning", latency: "67ms" },
]

const trafficData = [
  { hour: "00:00", value: 1200 },
  { hour: "04:00", value: 800 },
  { hour: "08:00", value: 1800 },
  { hour: "12:00", value: 2400 },
  { hour: "16:00", value: 2800 },
  { hour: "20:00", value: 3200 },
  { hour: "24:00", value: 2100 },
]

export default function AdminDashboard() {
  const maxTraffic = Math.max(...trafficData.map(d => d.value))

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      
      <div className="flex-1 lg:ml-64">
        <AdminHeader title="Дашборд" subtitle="Обзор системы Frosty Proxy" />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="bg-card rounded-xl p-5 border border-border">
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${stat.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                      {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {stat.change}
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Traffic Chart */}
            <div className="lg:col-span-2 bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-foreground">Трафик за сутки</h3>
                  <p className="text-sm text-muted-foreground">Количество активных соединений</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-foreground font-medium">Сейчас: 2,847</span>
                </div>
              </div>
              
              {/* Simple bar chart */}
              <div className="flex items-end justify-between h-40 gap-2">
                {trafficData.map((data, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full bg-primary/20 rounded-t-sm relative overflow-hidden"
                      style={{ height: `${(data.value / maxTraffic) * 100}%` }}
                    >
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-sm transition-all duration-500"
                        style={{ height: '100%' }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{data.hour}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Активность</h3>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-muted-foreground">
                        {activity.user.slice(-2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                    {activity.server !== "-" && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {activity.server}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Server Status */}
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-foreground">Статус серверов</h3>
                <p className="text-sm text-muted-foreground">Нагрузка и количество пользователей</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-muted-foreground">Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-muted-foreground">Warning</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3">Сервер</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3">Статус</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3">Нагрузка</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3">Пользователей</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3">Латентность</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {serverStatus.map((server) => (
                    <tr key={server.name} className="hover:bg-secondary/50 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{server.name}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                          server.status === 'online' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-warning/10 text-warning'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            server.status === 'online' ? 'bg-success' : 'bg-warning'
                          }`} />
                          {server.status === 'online' ? 'Online' : 'Warning'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                server.load > 80 ? 'bg-destructive' : 
                                server.load > 60 ? 'bg-warning' : 'bg-success'
                              }`}
                              style={{ width: `${server.load}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-10">{server.load}%</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm text-foreground">{server.users}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-primary" />
                          <span className="text-sm text-foreground">{server.latency}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
