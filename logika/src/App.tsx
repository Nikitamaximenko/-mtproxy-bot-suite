import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const FlowPage = lazy(() => import('./pages/FlowPage'))

function RouteFallback() {
  return (
    <div className="bg-background text-muted flex min-h-dvh flex-col items-center justify-center gap-3 font-mono text-[13px] uppercase tracking-[0.08em]">
      <span className="bg-accent inline-block h-2 w-2 animate-pulse rounded-full" />
      Загрузка
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/potok" element={<FlowPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
