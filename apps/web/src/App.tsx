import { Navigate, NavLink, Route, Routes } from "react-router-dom"
import HomePage from "@/pages/HomePage"
import RecordPage from "@/pages/RecordPage"
import HistoryPage from "@/pages/HistoryPage"
import GeneratePage from "@/pages/GeneratePage"

function TopNav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm ${
      isActive ? "bg-black text-white" : "hover:bg-gray-100"
    }`

  return (
    <div className="border-b">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-2">
        <div className="font-semibold mr-4">Rent App</div>
        <NavLink to="/" className={linkClass} end>
          首页
        </NavLink>
        <NavLink to="/record" className={linkClass}>
          录入
        </NavLink>
        <NavLink to="/history" className={linkClass}>
          历史
        </NavLink>
        <NavLink to="/generate" className={linkClass}>
          生成
        </NavLink>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="mx-auto max-w-5xl px-4 py-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}
