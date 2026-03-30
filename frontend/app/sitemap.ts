import { MetadataRoute } from "next"
import { articles } from "./blog/articles"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://frostybot.ru",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://frostybot.ru/mini",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://frostybot.ru/blog",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...articles.map((a) => ({
      url: `https://frostybot.ru/blog/${a.slug}`,
      lastModified: new Date(a.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ]
}
