import { Link, useLocation } from 'react-router-dom'
import { isLiveMode } from '../lib/supabase'

export default function NavBar() {
  const location = useLocation()

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      location.pathname === path
        ? 'bg-[var(--color-brand)] text-white'
        : 'text-gray-700 hover:bg-gray-100'
    }`

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg text-[var(--color-brand)]">
          TowApp <span className="font-normal text-gray-400 text-sm">Ghana (placeholder name)</span>
        </Link>
        <nav className="flex gap-1 items-center">
          <Link className={linkClass('/')} to="/">Request Help</Link>
          <Link className={linkClass('/operator')} to="/operator">Operator</Link>
          <Link className={linkClass('/admin')} to="/admin">Admin</Link>
          <span
            className={`ml-2 text-xs px-2 py-1 rounded-full ${
              isLiveMode ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'
            }`}
            title={isLiveMode ? 'Connected to live Supabase backend' : 'Running in mock/local mode — no backend connected yet'}
          >
            {isLiveMode ? 'Live' : 'Mock mode'}
          </span>
        </nav>
      </div>
    </header>
  )
}
