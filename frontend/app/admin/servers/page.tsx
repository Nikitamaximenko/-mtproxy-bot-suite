"use client"

import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminHeader } from "@/components/admin/AdminHeader"
import { useState } from "react"
import { 
  Server, 
  Power, 
  RefreshCw, 
  Settings,
  Plus,
  MoreVertical,
  Globe,
  Users,
  Zap,
  HardDrive,
  Cpu,
  Wifi,
  AlertTriangle,
  Check,
  X,
  Copy,
  ExternalLink
} from "lucide-react"

interface ServerData {
  id: string
  name: string
  location: string
  ip: string
  port: number
  status: "online" | "offline" | "maintenance"
  load: number
  users: number
  maxUsers: number
  latency: number
  uptime: string
  cpu: number
  ram: number
  bandwidth: { used: number; total: number }
}

const servers: ServerData[] = [
  { 
    id: "eu-1",
    name: "EU-1 Frankfurt", 
    location: "Frankfurt, DE",
    ip: "45.142.XXX.XXX",
    port: 443,
    status: "online",
    load: 78,
    users: 423,
    maxUsers: 600,
    latency: 12,
    uptime: "99.98%",
    cpu: 65,
    ram: 72,
    bandwidth: { used: 847, total: 1000 }
  },
  { 
    id: "eu-2",
    name: "EU-2 Amsterdam", 
    location: "Amsterdam, NL",
    ip: "185.234.XXX.XXX",
    port: 443,
    status: "online",
    load: 45,
    users: 267,
    maxUsers: 600,
    latency: 18,
    uptime: "99.95%",
    cpu: 42,
    ram: 48,
    bandwidth: { used: 523, total: 1000 }
  },
  { 
    id: "eu-3",
    name: "EU-3 London", 
    location: "London, UK",
    ip: "91.207.XXX.XXX",
    port: 443,
    status: "online",
    load: 62,
    users: 341,
    maxUsers: 500,
    latency: 24,
    uptime: "99.92%",
    cpu: 58,
    ram: 61,
    bandwidth: { used: 678, total: 1000 }
  },
  { 
    id: "us-1",
    name: "US-1 New York", 
    location: "New York, US",
    ip: "104.238.XXX.XXX",
    port: 443,
    status: "online",
    load: 34,
    users: 189,
    maxUsers: 400,
    latency: 89,
    uptime: "99.99%",
    cpu: 28,
    ram: 35,
    bandwidth: { used: 312, total: 1000 }
  },
  { 
    id: "us-2",
    name: "US-2 Los Angeles", 
    location: "Los Angeles, US",
    ip: "209.141.XXX.XXX",
    port: 443,
    status: "maintenance",
    load: 0,
    users: 0,
    maxUsers: 400,
    latency: 0,
    uptime: "98.50%",
    cpu: 0,
    ram: 0,
    bandwidth: { used: 0, total: 1000 }
  },
  { 
    id: "as-1",
    name: "AS-1 Singapore", 
    location: "Singapore, SG",
    ip: "139.99.XXX.XXX",
    port: 443,
    status: "online",
    load: 91,
    users: 512,
    maxUsers: 500,
    latency: 67,
    uptime: "99.87%",
    cpu: 89,
    ram: 92,
    bandwidth: { used: 945, total: 1000 }
  },
]

function ServerCard({ server }: { server: ServerData }) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyIP = () => {
    navigator.clipboard.writeText(`${server.ip}:${server.port}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusColors = {
    online: "bg-success",
    offline: "bg-destructive",
    maintenance: "bg-warning"
  }

  const statusLabels = {
    online: "Online",
    offline: "Offline",
    maintenance: "Maintenance"
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${
              server.status === 'online' ? 'bg-primary' : 
              server.status === 'maintenance' ? 'bg-warning' : 'bg-muted'
            } flex items-center justify-center`}>
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{server.name}</h3>
              <p className="text-sm text-muted-foreground">{server.location}</p>
            </div>
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 w-48 bg-card border border-border rounded-lg shadow-lg z-10">
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                  <RefreshCw className="w-4 h-4" />
                  Перезагрузить
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                  <Settings className="w-4 h-4" />
                  Настройки
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors">
                  <Power className="w-4 h-4" />
                  {server.status === 'online' ? 'Остановить' : 'Запустить'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 mt-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            server.status === 'online' ? 'bg-success/10 text-success' :
            server.status === 'maintenance' ? 'bg-warning/10 text-warning' :
            'bg-destructive/10 text-destructive'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusColors[server.status]}`} />
            {statusLabels[server.status]}
          </span>
          <span className="text-xs text-muted-foreground">Uptime: {server.uptime}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-4">
        {/* IP Address */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">IP:Port</span>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono text-foreground bg-secondary px-2 py-0.5 rounded">
              {server.ip}:{server.port}
            </code>
            <button 
              onClick={copyIP}
              className="p-1 hover:bg-secondary rounded transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* Users */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Пользователей
            </span>
            <span className="text-foreground font-medium">{server.users} / {server.maxUsers}</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                (server.users / server.maxUsers) > 0.9 ? 'bg-destructive' :
                (server.users / server.maxUsers) > 0.7 ? 'bg-warning' : 'bg-primary'
              }`}
              style={{ width: `${(server.users / server.maxUsers) * 100}%` }}
            />
          </div>
        </div>

        {/* CPU */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              CPU
            </span>
            <span className="text-foreground font-medium">{server.cpu}%</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                server.cpu > 80 ? 'bg-destructive' :
                server.cpu > 60 ? 'bg-warning' : 'bg-success'
              }`}
              style={{ width: `${server.cpu}%` }}
            />
          </div>
        </div>

        {/* RAM */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              RAM
            </span>
            <span className="text-foreground font-medium">{server.ram}%</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                server.ram > 80 ? 'bg-destructive' :
                server.ram > 60 ? 'bg-warning' : 'bg-success'
              }`}
              style={{ width: `${server.ram}%` }}
            />
          </div>
        </div>

        {/* Bandwidth */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5" />
              Bandwidth
            </span>
            <span className="text-foreground font-medium">{server.bandwidth.used} / {server.bandwidth.total} GB</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full bg-primary"
              style={{ width: `${(server.bandwidth.used / server.bandwidth.total) * 100}%` }}
            />
          </div>
        </div>

        {/* Latency */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Латентность
          </span>
          <span className={`text-sm font-medium ${
            server.latency < 30 ? 'text-success' :
            server.latency < 100 ? 'text-warning' : 'text-destructive'
          }`}>
            {server.latency}ms
          </span>
        </div>
      </div>
    </div>
  )
}

export default function ServersPage() {
  const [showAddModal, setShowAddModal] = useState(false)
  
  const onlineServers = servers.filter(s => s.status === 'online').length
  const totalUsers = servers.reduce((acc, s) => acc + s.users, 0)
  const avgLoad = Math.round(servers.filter(s => s.status === 'online').reduce((acc, s) => acc + s.load, 0) / onlineServers)

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      
      <div className="flex-1 lg:ml-64">
        <AdminHeader title="Серверы" subtitle="Управление прокси-серверами" />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Server className="w-4 h-4" />
                Серверов
              </div>
              <p className="text-2xl font-bold text-foreground">{onlineServers}/{servers.length}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="w-4 h-4" />
                Пользователей
              </div>
              <p className="text-2xl font-bold text-foreground">{totalUsers.toLocaleString()}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Cpu className="w-4 h-4" />
                Ср. нагрузка
              </div>
              <p className="text-2xl font-bold text-foreground">{avgLoad}%</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <AlertTriangle className="w-4 h-4" />
                Проблемы
              </div>
              <p className="text-2xl font-bold text-warning">1</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Все серверы</h2>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                <RefreshCw className="w-4 h-4" />
                Обновить
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Добавить сервер
              </button>
            </div>
          </div>

          {/* Server Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {servers.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>

          {/* Warning Banner */}
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground">Сервер AS-1 Singapore перегружен</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Нагрузка превышает 90%. Рекомендуем перераспределить пользователей или добавить новый сервер в регионе.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button className="text-sm font-medium text-primary hover:underline">
                  Перераспределить
                </button>
                <span className="text-muted-foreground">|</span>
                <button className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Игнорировать
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Server Modal (placeholder) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Добавить сервер</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-secondary rounded">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Название</label>
                <input type="text" className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm" placeholder="EU-4 Paris" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">IP адрес</label>
                <input type="text" className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm" placeholder="192.168.1.1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Порт</label>
                <input type="text" className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm" placeholder="443" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Макс. пользователей</label>
                <input type="text" className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm" placeholder="500" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
                Отмена
              </button>
              <button className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors">
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
