/**
 * Postmypost REST API v4.1 client.
 * Docs: https://help.postmypost.io/docs/api/postmypost-rest-api
 *
 * Note: GET /channels returns the catalog of supported networks (id/code/name),
 * not the user’s connected accounts. Connected accounts use GET /accounts?project_id=…
 */

export class PostmypostError extends Error {
  readonly status: number
  readonly code?: string
  readonly body?: unknown

  constructor(message: string, opts: { status: number; code?: string; body?: unknown }) {
    super(message)
    this.name = "PostmypostError"
    this.status = opts.status
    this.code = opts.code
    this.body = opts.body
  }
}

export type PostmypostPagination = {
  page: number
  per_page: number
  total_pages: number
  total_count: number
  prev: number | null
  next: number | null
}

/** One row from GET /channels (supported network type in the product). */
export type PostmypostChannel = {
  id: number
  code: string
  name: string
}

export type PostmypostChannelsResponse = {
  data: PostmypostChannel[]
  pages: PostmypostPagination
}

/** POST /publications — тело как в API (валидация ответила snake_case / integer). */
export type CreatePublicationBody = {
  project_id: number
  post_at: string
  account_ids: number[]
  publication_status: number
  details: Record<string, unknown>
  media_file_ids?: number[]
  rubric_id?: number
}

/** Ответ по публикации: оставляем гибко, пока не зафиксирован полный объект в спеке. */
export type PostmypostPublication = {
  id?: number | string
  publication_status?: number
  project_id?: number
  post_at?: string
  account_ids?: number[]
  details?: Record<string, unknown>
  [key: string]: unknown
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (v == null || String(v).trim() === "") {
    throw new PostmypostError(`Missing environment variable ${name}`, { status: 500 })
  }
  return v.trim()
}

function apiBase(): string {
  return requireEnv("POSTMYPOST_API_BASE_URL").replace(/\/$/, "")
}

function bearer(): string {
  return requireEnv("POSTMYPOST_API_TOKEN")
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function errMessageFromBody(body: unknown): string {
  if (!isRecord(body)) return "Request failed"
  const name = typeof body.name === "string" ? body.name : ""
  const msg = typeof body.message === "string" ? body.message : ""
  return [name, msg].filter(Boolean).join(": ") || "Request failed"
}

function errCodeFromBody(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined
  if (typeof body.code === "number" || typeof body.code === "string") return String(body.code)
  return undefined
}

/**
 * Низкоуровневый запрос. path — путь относительно POSTMYPOST_API_BASE_URL (например `/channels`).
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token: string
  let base: string
  try {
    token = bearer()
    base = apiBase()
  } catch (e) {
    if (e instanceof PostmypostError) throw e
    throw e
  }

  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${token}`)

  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  let parsed: unknown = text
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!res.ok) {
    throw new PostmypostError(errMessageFromBody(parsed), {
      status: res.status,
      code: errCodeFromBody(parsed),
      body: parsed,
    })
  }

  return parsed as T
}

export async function requestJson<T>(
  path: string,
  json: unknown,
  init?: Omit<RequestInit, "body" | "method"> & { method?: string },
): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set("Content-Type", "application/json")
  return request<T>(path, {
    ...init,
    method: init?.method ?? "POST",
    headers,
    body: JSON.stringify(json),
  })
}

/**
 * Список типов каналов (соцсетей), доступных в системе.
 * GET /channels → `{ data, pages }`; возвращаем `data`.
 */
export async function getChannels(): Promise<PostmypostChannel[]> {
  const body = await request<PostmypostChannelsResponse>("/channels", { method: "GET" })
  if (!body || !Array.isArray(body.data)) {
    throw new PostmypostError("Unexpected GET /channels response shape", { status: 500, body })
  }
  return body.data
}

type UploadInitParsed = {
  id: number
  postUrl: string
  fields: Record<string, string>
  fileFieldName: string
}

function parseUploadInit(json: unknown): UploadInitParsed {
  if (!isRecord(json)) {
    throw new PostmypostError("upload/init: expected object response", { status: 500, body: json })
  }
  const root = isRecord(json.data) ? (json.data as Record<string, unknown>) : json

  const idRaw = root.id ?? root.file_id ?? (isRecord(root.data) ? (root.data as Record<string, unknown>).id : undefined)
  const id = typeof idRaw === "number" ? idRaw : Number(idRaw)
  if (!Number.isFinite(id)) {
    throw new PostmypostError("upload/init: could not parse file id", { status: 500, body: json })
  }

  const upload =
    (isRecord(root.upload) ? root.upload : null) ??
    (isRecord(root.upload_credentials) ? root.upload_credentials : null) ??
    (isRecord(root.presigned_post) ? root.presigned_post : null) ??
    root

  const postUrl =
    (typeof upload.url === "string" && upload.url) ||
    (typeof upload.upload_url === "string" && upload.upload_url) ||
    (typeof upload.post_url === "string" && upload.post_url) ||
    ""

  const fieldsRaw =
    (isRecord(upload.fields) ? upload.fields : null) ??
    (isRecord(upload.form_data) ? upload.form_data : null) ??
    (isRecord(upload.form_fields) ? upload.form_fields : null)

  const fields: Record<string, string> = {}
  if (fieldsRaw) {
    for (const [k, v] of Object.entries(fieldsRaw)) {
      if (v != null) fields[k] = String(v)
    }
  }

  if (!postUrl || Object.keys(fields).length === 0) {
    throw new PostmypostError(
      "upload/init: missing presigned POST url/fields — check API response (тариф / формат)",
      { status: 500, body: json },
    )
  }

  const fileFieldName =
    Object.keys(fields).find((k) => k === "file" || /filename|content/i.test(k)) ?? "file"

  return { id, postUrl, fields, fileFieldName }
}

/**
 * Прямая загрузка файла: POST /upload/init → POST на S3 по presigned form → POST /upload/complete.
 * Требуется `project_id` (как в доке по upload).
 */
export async function uploadFile(
  file: Buffer | Blob,
  filename: string,
  project_id: number,
): Promise<{ id: string }> {
  const blob = file instanceof Blob ? file : new Blob([new Uint8Array(file)])
  const size = blob.size

  const initRaw = await requestJson<unknown>("/upload/init", {
    project_id,
    name: filename,
    size,
  })

  const { id, postUrl, fields, fileFieldName } = parseUploadInit(initRaw)

  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (k !== fileFieldName) form.append(k, v)
  }
  form.append(fileFieldName, blob, filename)

  const s3res = await fetch(postUrl, { method: "POST", body: form })
  if (!s3res.ok) {
    const t = await s3res.text()
    let b: unknown = t
    try {
      b = t ? JSON.parse(t) : t
    } catch {
      /* keep text */
    }
    throw new PostmypostError("S3 upload failed", { status: s3res.status, body: b })
  }

  const completeRaw = await requestJson<unknown>("/upload/complete", { id })
  const completeRoot = isRecord(completeRaw) && isRecord(completeRaw.data) ? completeRaw.data : completeRaw
  const doneId =
    isRecord(completeRoot) && completeRoot.id != null
      ? completeRoot.id
      : isRecord(completeRaw) && completeRaw.id != null
        ? completeRaw.id
        : id

  return { id: String(doneId) }
}

export async function createPublication(body: CreatePublicationBody): Promise<PostmypostPublication> {
  return requestJson<PostmypostPublication>("/publications", body)
}

export async function getPublication(id: string | number, project_id: number): Promise<PostmypostPublication> {
  const q = new URLSearchParams({ project_id: String(project_id) })
  return request<PostmypostPublication>(`/publications/${encodeURIComponent(String(id))}?${q}`, { method: "GET" })
}
