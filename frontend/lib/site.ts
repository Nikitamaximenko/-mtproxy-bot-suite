/**
 * Канонический домен сайта (без слэша в конце).
 *
 * Используется в canonical-ссылках, JSON-LD, sitemap.xml, robots.txt и
 * Open Graph. В SEO критически важно, чтобы ЭТОТ URL совпадал с тем,
 * по которому реально отдаётся контент без редиректов. Иначе поисковики
 * получают противоречивые сигналы (sitemap ведёт на URL, который 307-
 * редиректит на другой; на redirected URL канонический снова указывает
 * на первый и т. д.) и отказываются индексировать.
 *
 * По умолчанию — apex-домен `https://frostybot.ru` (без www). Если на
 * стороне Vercel primary-домен другой (например, `www.frostybot.ru`),
 * задаём `NEXT_PUBLIC_SITE_URL` в настройках проекта, чтобы код выдавал
 * правильный канонический.
 */
export const SITE_URL: string = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
  if (raw && raw.startsWith("http")) {
    return raw.replace(/\/+$/, "")
  }
  return "https://frostybot.ru"
})()

export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "")
