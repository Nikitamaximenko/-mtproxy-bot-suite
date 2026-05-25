export type Article = {
  slug: string
  title: string
  description: string
  keywords: string[]
  content: string
  publishedAt: string
  /** guide | top | myth | region — для фильтрации на странице блога */
  category?: "guide" | "top" | "myth" | "region"
}
