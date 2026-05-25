#!/usr/bin/env node
/** Submit all blog URLs to IndexNow (Yandex/Bing) */
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE = process.env.SITE_URL || "https://frostybot.ru"
const KEY = process.env.INDEXNOW_KEY || "frostyblog2026index"

// Parse slugs from articles-batch + legacy via simple regex on articles.ts export
const articlesPath = join(__dirname, "../frontend/app/blog/articles.ts")
const batchPath = join(__dirname, "../frontend/app/blog/articles-batch-2026.ts")
const slugs = new Set()
for (const p of [articlesPath, batchPath]) {
  const src = readFileSync(p, "utf8")
  for (const m of src.matchAll(/slug:\s*"([^"]+)"/g)) slugs.add(m[1])
}

const urlList = [
  SITE,
  `${SITE}/blog`,
  ...[...slugs].map((s) => `${SITE}/blog/${s}`),
]

const host = SITE.replace(/^https?:\/\//, "")

const res = await fetch("https://yandex.com/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host,
    key: KEY,
    keyLocation: `${SITE}/${KEY}.txt`,
    urlList: urlList.slice(0, 10000),
  }),
})

console.log("IndexNow status:", res.status, await res.text())
