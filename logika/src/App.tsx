import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { FlowPage } from './pages/FlowPage'
import { LandingPage } from './pages/LandingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/potok" element={<FlowPage />} />
      </Routes>
    </BrowserRouter>
  )
}
