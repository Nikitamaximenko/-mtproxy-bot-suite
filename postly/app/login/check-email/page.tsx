export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-lg font-semibold">Проверьте почту</h1>
        <p className="text-sm text-muted-foreground">
          Мы отправили ссылку для входа на указанный email.
        </p>
        <p className="text-sm text-muted-foreground">
          В DEV-режиме ссылка печатается в консоль сервера — откройте терминал, где запущен{" "}
          <code className="rounded bg-muted px-1">npm run dev</code>.
        </p>
      </div>
    </main>
  )
}
