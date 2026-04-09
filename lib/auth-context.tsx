// auth-context.tsx
"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import type { UserLocal } from "./types/frontend-types"
import { authenticateUser, getCurrentUser, apiEndpoint } from "./api-client"

interface AuthContextValue {
  user: UserLocal | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserLocal | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUser({})
      .then((u) => setUser(u ?? null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      const u = await authenticateUser({ email, password })
      if (!u) {
        return { error: "Credenciales invalidas" }
      }
      setUser(u)
      return {}
    },
    []
  )

  const logout = useCallback(async () => {
    await fetch(apiEndpoint("/api/logout"), { method: "POST", credentials: "include", body: JSON.stringify({}) })
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (user) {
      const u = await getCurrentUser({})
      if (u) setUser(u)
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}