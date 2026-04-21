import type { AnalysisReport } from '../../../shared/types.js'

/**
 * Renders PDF through the same preview template used by the web app,
 * parameterised with the report data via `?r=<base64>`. Puppeteer prints A4.
 *
 * Requires `PDF_PREVIEW_URL` (full URL to the preview HTML) and optionally
 * `PDF_CHROMIUM_PATH` for the Chromium binary.
 */
export async function renderReportPdf(report: AnalysisReport): Promise<Buffer> {
  const previewUrl = process.env.PDF_PREVIEW_URL
  if (!previewUrl) {
    throw new Error('PDF_PREVIEW_URL not set')
  }

  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.launch({
    executablePath: process.env.PDF_CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    const payload = Buffer.from(JSON.stringify(report)).toString('base64url')
    await page.goto(`${previewUrl}?r=${payload}`, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
