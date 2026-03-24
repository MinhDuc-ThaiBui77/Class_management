import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/students',   label: 'Học sinh',   adminOnly: false },
  { to: '/teachers',   label: 'Giáo viên',  adminOnly: false },
  { to: '/classes',    label: 'Lớp học',    adminOnly: false },
  { to: '/attendance', label: 'Điểm danh & Lịch dạy', adminOnly: false },
  { to: '/payments',   label: 'Học phí',    adminOnly: false },
  { to: '/reports',    label: 'Báo cáo',    adminOnly: true  },
  { to: '/accounts',   label: 'Tài khoản',  adminOnly: true  },
]

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <h1 className="font-semibold text-gray-800">ClassManager</h1>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{user?.fullName}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.filter(item => !item.adminOnly || isAdmin).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
