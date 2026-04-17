import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/success"],
      },
      {
        // Яндексу нужен отдельный блок, чтобы корректно учитывать host и правила
        userAgent: "Yandex",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/success"],
      },
    ],
    sitemap: "https://frostybot.ru/sitemap.xml",
    host: "https://frostybot.ru",
  }
}
