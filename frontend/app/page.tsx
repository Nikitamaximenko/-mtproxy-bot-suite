"use client"

import { useState } from "react"
import { Home, CreditCard, User, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { MainScreen } from "@/components/screens/MainScreen"
import { PaymentScreen } from "@/components/screens/PaymentScreen"
import { AccountScreen } from "@/components/screens/AccountScreen"
import { AdminScreen } from "@/components/screens/AdminScreen"

type Screen = "main" | "payment" | "account" | "admin"

const navItems = [
  { id: "main" as Screen, label: "Главная", icon: Home },
  { id: "payment" as Screen, label: "Оплата", icon: CreditCard },
  { id: "account" as Screen, label: "Аккаунт", icon: User },
  { id: "admin" as Screen, label: "Админ", icon: Settings },
]

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("main")
  const [isConnected, setIsConnected] = useState(false)
  const [isPaid, setIsPaid] = useState(false)

  const handleConnect = () => {
    if (isPaid) {
      setIsConnected(!isConnected)
    } else {
      setCurrentScreen("payment")
    }
  }

  const handlePaymentSuccess = () => {
    setIsPaid(true)
    setCurrentScreen("main")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        {currentScreen === "main" && (
          <MainScreen
            isConnected={isConnected}
            isPaid={isPaid}
            onConnect={handleConnect}
          />
        )}
        {currentScreen === "payment" && (
          <PaymentScreen onSuccess={handlePaymentSuccess} />
        )}
        {currentScreen === "account" && (
          <AccountScreen isPaid={isPaid} isConnected={isConnected} />
        )}
        {currentScreen === "admin" && <AdminScreen />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border safe-area-pb">
        <div className="max-w-lg mx-auto flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentScreen === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentScreen(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
