import type { AnalysisReport } from '../../../shared/types.js'

/**
 * Renders the dark-themed PDF using the SAME html template as the web app
 * (`logika/public/pdf-preview.html`). Template is parameterised with the
 * report data via `?r=<base64>` query string, then Puppeteer prints A4.
 *
 * Why the same template:
 *   — single source of truth for report visual design (no drift)
 *   — `-webkit-print-color-adjust: exact` keeps the dark theme 1:1
 *   — every web download and every bot download look identical
 */
export async function renderReportPdf(_report: AnalysisReport): Promise<Buffer> {
  const previewUrl = process.env.PDF_PREVIEW_URL
  if (!previewUrl) {
    throw new Error('PDF_PREVIEW_URL not set')
  }

  // Lazy import so dev-time without puppeteer still compiles.
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.launch({
    executablePath: process.env.PDF_CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    const payload = Buffer.from(JSON.stringify(_report)).toString('base64url')
    await page.goto(`${previewUrl}?r=${payload}`, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
