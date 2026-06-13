import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  LayoutDashboard,
  Leaf,
  Megaphone,
  ScrollText,
  Send,
  Server,
  Users,
} from "lucide-react"

export type AdminNavItem = {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

export type AdminNavGroup = {
  label: string
  items: AdminNavItem[]
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Главное",
    items: [
      {
        href: "/admin",
        label: "Сводка",
        description: "Статус VPN и ключевые цифры",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Люди и оплаты",
    items: [
      {
        href: "/admin/users",
        label: "Пользователи",
        description: "Поиск, доступ, включить VPN",
        icon: Users,
      },
      {
        href: "/admin/logs",
        label: "Логи",
        description: "Checkout, ЮKassa, ИИ-поддержка",
        icon: ScrollText,
      },
    ],
  },
  {
    label: "Действия",
    items: [
      {
        href: "/admin/campaigns",
        label: "Кампании",
        description: "Push, A/B тесты, автогенерация текстов",
        icon: Megaphone,
      },
      {
        href: "/admin/operations",
        label: "Операции",
        description: "Рассылка, самотест, очистка БД",
        icon: Send,
      },
    ],
  },
  {
    label: "Инфраструктура",
    items: [
      {
        href: "/admin/servers",
        label: "Серверы",
        description: "MTProxy и VPN Reality",
        icon: Server,
      },
      {
        href: "/admin/amnezia",
        label: "Amnezia",
        description: "Whitelist и ключи AWG",
        icon: Leaf,
      },
    ],
  },
  {
    label: "Аналитика",
    items: [
      {
        href: "/admin/analytics",
        label: "Аналитика",
        description: "Воронка, выручка, источники",
        icon: BarChart3,
      },
    ],
  },
]

export const ADMIN_QUICK_LINKS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items).filter(
  (item) => item.href !== "/admin",
)
