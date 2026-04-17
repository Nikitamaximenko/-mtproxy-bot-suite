"use client"

import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminHeader } from "@/components/admin/AdminHeader"
import { useState } from "react"
import { 
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Activity,
  Globe,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react"

const revenueData = [
  { month: "Янв", revenue: 425000, users: 1850 },
  { month: "Фев", revenue: 512000, users: 2100 },
  { month: "Мар", revenue: 589000, users: 2340 },
  { month: "Апр", revenue: 634000, users: 2450 },
  { month: "Май", revenue: 721000, users: 2620 },
  { month: "Июн", revenue: 847500, users: 2847 },
]

const geoData = [
  { country: "Россия", users: 1847, percentage: 65 },
  { country: "Украина", users: 423, percentage: 15 },
  { country: "Беларусь", users: 284, percentage: 10 },
  { country: "Казахстан", users: 170, percentage: 6 },
  { country: "Другие", users: 123, percentage: 4 },
]

const planDistribution = [
  { plan: "Premium", users: 847, revenue: 847000, color: "bg-warning" },
  { plan: "Basic", users: 1423, revenue: 711500, color: "bg-primary" },
  { plan: "Free (Trial)", users: 577, revenue: 0, color: "bg-muted" },
]

const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  users: Math.floor(Math.random() * 500) + 100 + (i >= 10 && i <= 22 ? 800 : 0)
}))

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month")
  
  const maxRevenue = Math.max(...revenueData.map(d => d.revenue))
  const totalRevenue = revenueData[revenueData.length - 1].revenue
  const prevRevenue = revenueData[revenueData.length - 2].revenue
  const revenueChange = ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1)
  
  const totalUsers = revenueData[revenueData.length - 1].users
  const prevUsers = revenueData[revenueData.length - 2].users
  const usersChange = ((totalUsers - prevUsers) / prevUsers * 100).toFixed(1)

  const maxHourlyUsers = Math.max(...hourlyActivity.map(h => h.users))

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      
      <div className="flex-1 lg:ml-64">
        <AdminHeader title="Аналитика" subtitle="Статистика и метрики" />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Period Selector */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Обзор</h2>
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
              {(["week", "month", "year"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    period === p 
                      ? 'bg-card text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Год'}
                </button>
              ))}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-success" />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium text-success`}>
                  <ArrowUpRight className="w-3 h-3" />
                  +{revenueChange}%
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground mt-4">
                {(totalRevenue / 1000).toFixed(0)}K ₽
              </p>
              <p className="text-sm text-muted-foreground">Выручка за месяц</p>
            </div>

            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium text-success`}>
                  <ArrowUpRight className="w-3 h-3" />
                  +{usersChange}%
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground mt-4">{totalUsers.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Активных пользователей</p>
            </div>

            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-warning" />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium text-success`}>
                  <ArrowUpRight className="w-3 h-3" />
                  +5.2%
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground mt-4">297 ₽</p>
              <p className="text-sm text-muted-foreground">Ср. чек</p>
            </div>

            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-ice/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-ice" />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium text-destructive`}>
                  <ArrowDownRight className="w-3 h-3" />
                  -2.1%
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground mt-4">4.2%</p>
              <p className="text-sm text-muted-foreground">Отток (Churn)</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <div className="lg:col-span-2 bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-foreground">Выручка</h3>
                  <p className="text-sm text-muted-foreground">Динамика за 6 месяцев</p>
                </div>
              </div>
              
              <div className="flex items-end justify-between h-48 gap-4">
                {revenueData.map((data, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {(data.revenue / 1000).toFixed(0)}K
                    </span>
                    <div 
                      className="w-full bg-primary/20 rounded-t relative overflow-hidden"
                      style={{ height: `${(data.revenue / maxRevenue) * 140}px` }}
                    >
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-primary/70 rounded-t"
                        style={{ height: '100%' }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{data.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Distribution */}
            <div className="bg-card rounded-xl p-5 border border-border">
              <h3 className="font-semibold text-foreground mb-4">Распределение тарифов</h3>
              <div className="space-y-4">
                {planDistribution.map((plan) => (
                  <div key={plan.plan}>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-foreground font-medium">{plan.plan}</span>
                      <span className="text-muted-foreground">{plan.users} пользователей</span>
                    </div>
                    <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${plan.color}`}
                        style={{ width: `${(plan.users / totalUsers) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.revenue > 0 ? `${(plan.revenue / 1000).toFixed(0)}K ₽ выручки` : 'Бесплатный период'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Geography */}
            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">География пользователей</h3>
                <Globe className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                {geoData.map((geo) => (
                  <div key={geo.country} className="flex items-center gap-4">
                    <div className="w-20 text-sm text-foreground">{geo.country}</div>
                    <div className="flex-1">
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${geo.percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-right">
                      <span className="text-sm font-medium text-foreground">{geo.percentage}%</span>
                    </div>
                    <div className="w-16 text-right">
                      <span className="text-xs text-muted-foreground">{geo.users}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hourly Activity */}
            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Активность по часам</h3>
                <Activity className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-end gap-1 h-32">
                {hourlyActivity.map((hour) => (
                  <div 
                    key={hour.hour}
                    className="flex-1 bg-primary/30 rounded-t hover:bg-primary/50 transition-colors cursor-pointer group relative"
                    style={{ height: `${(hour.users / maxHourlyUsers) * 100}%` }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity">
                      {hour.hour}:00 — {hour.users}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>
          </div>

          {/* Conversion Funnel */}
          <div className="bg-card rounded-xl p-5 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Воронка конверсий</h3>
            <div className="flex items-center justify-between gap-4">
              {[
                { label: "Посетители", value: 12450, percentage: 100 },
                { label: "Запустили бота", value: 5678, percentage: 45.6 },
                { label: "Активировали trial", value: 3421, percentage: 27.5 },
                { label: "Оплатили", value: 2270, percentage: 18.2 },
                { label: "Продлили", value: 1847, percentage: 14.8 },
              ].map((step, i) => (
                <div key={step.label} className="flex-1 text-center">
                  <div 
                    className="mx-auto mb-3 bg-primary/20 rounded-lg flex items-center justify-center"
                    style={{ 
                      width: `${40 + step.percentage * 0.6}%`,
                      height: `${60 + step.percentage * 0.4}px`,
                      minWidth: '60px'
                    }}
                  >
                    <span className="text-sm font-semibold text-primary">{step.percentage}%</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{step.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{step.label}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
