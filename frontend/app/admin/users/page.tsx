"use client"

import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminHeader } from "@/components/admin/AdminHeader"
import { useState } from "react"
import { 
  Search, 
  Filter,
  MoreVertical,
  Crown,
  User,
  Ban,
  Trash2,
  Mail,
  Calendar,
  Server,
  ChevronLeft,
  ChevronRight,
  Download,
  UserPlus
} from "lucide-react"

interface UserData {
  id: string
  telegramId: string
  username: string
  plan: "free" | "basic" | "premium"
  status: "active" | "inactive" | "banned"
  server: string
  registeredAt: string
  lastActive: string
  totalPaid: number
}

const users: UserData[] = [
  { id: "1", telegramId: "123456789", username: "@user_alpha", plan: "premium", status: "active", server: "EU-1", registeredAt: "2024-01-15", lastActive: "2 мин назад", totalPaid: 12000 },
  { id: "2", telegramId: "987654321", username: "@telegram_user", plan: "basic", status: "active", server: "EU-2", registeredAt: "2024-02-20", lastActive: "5 мин назад", totalPaid: 3500 },
  { id: "3", telegramId: "456789123", username: "@cool_guy", plan: "basic", status: "active", server: "EU-1", registeredAt: "2024-03-01", lastActive: "1 час назад", totalPaid: 2000 },
  { id: "4", telegramId: "789123456", username: "@new_user", plan: "free", status: "inactive", server: "-", registeredAt: "2024-03-10", lastActive: "3 дня назад", totalPaid: 0 },
  { id: "5", telegramId: "321654987", username: "@pro_member", plan: "premium", status: "active", server: "AS-1", registeredAt: "2024-01-05", lastActive: "10 мин назад", totalPaid: 24000 },
  { id: "6", telegramId: "654987321", username: "@banned_user", plan: "basic", status: "banned", server: "-", registeredAt: "2024-02-01", lastActive: "1 мес назад", totalPaid: 500 },
  { id: "7", telegramId: "147258369", username: "@active_member", plan: "basic", status: "active", server: "US-1", registeredAt: "2024-02-28", lastActive: "30 мин назад", totalPaid: 1500 },
  { id: "8", telegramId: "369258147", username: "@vip_client", plan: "premium", status: "active", server: "EU-3", registeredAt: "2023-12-01", lastActive: "1 мин назад", totalPaid: 36000 },
]

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterPlan, setFilterPlan] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showUserMenu, setShowUserMenu] = useState<string | null>(null)

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.telegramId.includes(searchQuery)
    const matchesPlan = filterPlan === "all" || user.plan === filterPlan
    const matchesStatus = filterStatus === "all" || user.status === filterStatus
    return matchesSearch && matchesPlan && matchesStatus
  })

  const planColors = {
    free: "bg-muted text-muted-foreground",
    basic: "bg-primary/10 text-primary",
    premium: "bg-warning/10 text-warning"
  }

  const planLabels = {
    free: "Free",
    basic: "Basic",
    premium: "Premium"
  }

  const statusColors = {
    active: "bg-success/10 text-success",
    inactive: "bg-muted text-muted-foreground",
    banned: "bg-destructive/10 text-destructive"
  }

  const statusLabels = {
    active: "Активен",
    inactive: "Неактивен",
    banned: "Заблокирован"
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleAllUsers = () => {
    setSelectedUsers(prev => 
      prev.length === filteredUsers.length 
        ? [] 
        : filteredUsers.map(u => u.id)
    )
  }

  const totalPremium = users.filter(u => u.plan === 'premium').length
  const totalBasic = users.filter(u => u.plan === 'basic').length
  const totalActive = users.filter(u => u.status === 'active').length

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      
      <div className="flex-1 lg:ml-64">
        <AdminHeader title="Пользователи" subtitle="Управление подписчиками" />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <User className="w-4 h-4" />
                Всего
              </div>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Crown className="w-4 h-4 text-warning" />
                Premium
              </div>
              <p className="text-2xl font-bold text-foreground">{totalPremium}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <User className="w-4 h-4 text-primary" />
                Basic
              </div>
              <p className="text-2xl font-bold text-foreground">{totalBasic}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-success text-sm mb-1">
                <div className="w-2 h-2 rounded-full bg-success" />
                Онлайн
              </div>
              <p className="text-2xl font-bold text-foreground">{totalActive}</p>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Поиск по username или Telegram ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm"
                >
                  <option value="all">Все тарифы</option>
                  <option value="premium">Premium</option>
                  <option value="basic">Basic</option>
                  <option value="free">Free</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm"
                >
                  <option value="all">Все статусы</option>
                  <option value="active">Активные</option>
                  <option value="inactive">Неактивные</option>
                  <option value="banned">Заблокированные</option>
                </select>

                <button className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors border border-border">
                  <Download className="w-4 h-4" />
                  Экспорт
                </button>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left p-4">
                      <input 
                        type="checkbox"
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onChange={toggleAllUsers}
                        className="w-4 h-4 rounded border-border"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Пользователь</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Тариф</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Статус</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Сервер</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Последняя активность</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Всего оплачено</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="p-4">
                        <input 
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-4 h-4 rounded border-border"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            {user.plan === 'premium' ? (
                              <Crown className="w-4 h-4 text-warning" />
                            ) : (
                              <User className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{user.username}</p>
                            <p className="text-xs text-muted-foreground">ID: {user.telegramId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${planColors[user.plan]}`}>
                          {user.plan === 'premium' && <Crown className="w-3 h-3" />}
                          {planLabels[user.plan]}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[user.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            user.status === 'active' ? 'bg-success' :
                            user.status === 'banned' ? 'bg-destructive' : 'bg-muted-foreground'
                          }`} />
                          {statusLabels[user.status]}
                        </span>
                      </td>
                      <td className="p-4">
                        {user.server !== "-" ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                            <Server className="w-3.5 h-3.5 text-muted-foreground" />
                            {user.server}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{user.lastActive}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium text-foreground">
                          {user.totalPaid.toLocaleString()} ₽
                        </span>
                      </td>
                      <td className="p-4 relative">
                        <button 
                          onClick={() => setShowUserMenu(showUserMenu === user.id ? null : user.id)}
                          className="p-2 hover:bg-secondary rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {showUserMenu === user.id && (
                          <div className="absolute right-4 top-12 w-48 bg-card border border-border rounded-lg shadow-lg z-10">
                            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                              <Mail className="w-4 h-4" />
                              Написать
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                              <Crown className="w-4 h-4" />
                              Изменить тариф
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-warning hover:bg-secondary transition-colors">
                              <Ban className="w-4 h-4" />
                              {user.status === 'banned' ? 'Разблокировать' : 'Заблокировать'}
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors">
                              <Trash2 className="w-4 h-4" />
                              Удалить
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Показано {filteredUsers.length} из {users.length} пользователей
              </p>
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50" disabled>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="w-8 h-8 bg-primary text-white rounded-lg text-sm font-medium">1</button>
                <button className="w-8 h-8 hover:bg-secondary rounded-lg text-sm text-muted-foreground">2</button>
                <button className="w-8 h-8 hover:bg-secondary rounded-lg text-sm text-muted-foreground">3</button>
                <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-6 bg-card border border-border rounded-xl p-4 shadow-lg flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Выбрано: <span className="font-medium text-foreground">{selectedUsers.length}</span>
              </span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors">
                  Изменить тариф
                </button>
                <button className="px-3 py-1.5 text-sm text-warning hover:bg-warning/10 rounded-lg transition-colors">
                  Заблокировать
                </button>
                <button className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                  Удалить
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
