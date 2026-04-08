import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <h1 className="text-lg font-semibold">Вход</h1>
        <LoginForm />
      </div>
    </main>
  )
}
