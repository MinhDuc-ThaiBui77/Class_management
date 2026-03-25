import { createContext, useContext, useState } from 'react'
import { type ReactNode } from 'react'
import { flushSync } from 'react-dom'

interface User {
  fullName: string
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  // Role helpers
  isAdmin: boolean      // admin or owner
  isManager: boolean    // manager or above
  isOwner: boolean      // owner only
  canManage: boolean    // manager+ (quản lý lớp/HS/lịch/học phí)
  canAdmin: boolean     // admin+ (tài khoản, báo cáo, chi phí)
}

const AuthContext = createContext<AuthContextType | null>(null)

const ROLE_LEVEL: Record<string, number> = {
  teacher: 1,
  manager: 2,
  admin: 3,
  owner: 4,
}

function isAtLeast(userRole: string | undefined, required: string): boolean {
  return (ROLE_LEVEL[userRole ?? ''] ?? 0) >= (ROLE_LEVEL[required] ?? 99)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token')
  )
  const [user, setUser] = useState<User | null>(() => {
    const u = localStorage.getItem('user')
    return u ? JSON.parse(u) : null
  })

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    flushSync(() => {
      setToken(newToken)
      setUser(newUser)
    })
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const role = user?.role

  return (
    <AuthContext.Provider value={{
      user, token,
      login, logout,
      isOwner:   role === 'owner',
      isAdmin:   isAtLeast(role, 'admin'),
      isManager: isAtLeast(role, 'manager'),
      canManage: isAtLeast(role, 'manager'),
      canAdmin:  isAtLeast(role, 'admin'),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
