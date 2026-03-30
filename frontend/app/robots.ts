import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/blog/", "/mini"],
      disallow: ["/admin", "/api/"],
    },
    sitemap: "https://frostybot.ru/sitemap.xml",
  }
}
