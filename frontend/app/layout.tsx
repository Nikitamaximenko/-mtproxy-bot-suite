import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { BackendKeepAlive } from '@/components/BackendKeepAlive'
import './globals.css'

const _inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0066cc',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: "Frosty — личный прокси для Telegram",
  description: "Персональный MTProxy только для вас. Telegram работает даже когда заблокирован. 299 ₽/мес, подключение за 10 секунд.",
  keywords: "telegram прокси, mtproxy, телеграм прокси россия, обход блокировки telegram, frosty proxy",
  openGraph: {
    title: "Frosty — личный прокси для Telegram",
    description: "Персональный MTProxy только для вас. 299 ₽/мес.",
    url: "https://frostybot.ru",
    siteName: "Frosty",
    locale: "ru_RU",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://frostybot.ru",
  },
  verification: {
    google: "Wl2octBZAHk4YmGmnFgdZ0k2vjtLLuc8ZIxei_HAVss",
    yandex: "46ef654743bdfe9b",
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <head>
        {/*
          Telegram WebApp SDK — обязан быть подключён на странице, которая
          открывается внутри Telegram WebView, иначе window.Telegram.WebApp
          остаётся undefined: initDataUnsafe.user.id не читается, ready()
          не вызывается, openTelegramLink выбрасывает пользователя из WebView.
          Страница /mini без этого скрипта не умеет определять tg_id из
          Telegram-контекста и вынуждена опираться только на ?tg_id= в URL.
        */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="font-sans antialiased">
        <BackendKeepAlive />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
