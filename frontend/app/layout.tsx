import type { Metadata, Viewport } from 'next'
import { Manrope, Fraunces } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { BackendKeepAlive } from '@/components/BackendKeepAlive'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FBF7F2',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://frostybot.ru'),
  title: {
    default: 'Frosty — MTProxy + VPN для Telegram, Instagram, YouTube',
    template: '%s | Frosty',
  },
  description: 'Личный MTProxy для Telegram и VPN для Instagram, TikTok, YouTube и ChatGPT — всё в одной подписке. 299 ₽/мес, подключение за минуту.',
  applicationName: 'Frosty',
  keywords: 'telegram прокси, mtproxy, vpn, телеграм прокси россия, обход блокировки telegram, vpn для instagram, vpn для youtube, vpn россия 2025, frosty',
  openGraph: {
    title: 'Frosty — MTProxy + VPN в одной подписке',
    description: 'Личный MTProxy + VPN в одной подписке. 299 ₽/мес.',
    url: 'https://frostybot.ru',
    siteName: 'Frosty',
    locale: 'ru_RU',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  verification: {
    google: 'Wl2octBZAHk4YmGmnFgdZ0k2vjtLLuc8ZIxei_HAVss',
    yandex: '46ef654743bdfe9b',
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
    <html lang="ru" className={`${manrope.variable} ${fraunces.variable}`}>
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
        {/* Organization + WebSite JSON-LD: помогает Google и Яндексу
            показывать название/лого в сниппетах и включает sitelinks search. */}
        <Script
          id="ld-org"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Frosty',
              url: 'https://frostybot.ru',
              logo: 'https://frostybot.ru/icon-light-32x32.png',
              sameAs: ['https://t.me/frostytg_bot'],
            }),
          }}
        />
        <Script
          id="ld-website"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Frosty',
              url: 'https://frostybot.ru',
              inLanguage: 'ru-RU',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://frostybot.ru/blog?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className="font-sans antialiased selection:bg-blush-soft">
        <BackendKeepAlive />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
