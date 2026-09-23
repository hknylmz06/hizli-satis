import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)
const STORAGE_KEY = 'hizlisatis_auth'

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(load)

  const value = useMemo(() => ({
    session,
    login(data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setSession(data)
    },
    logout() {
      localStorage.removeItem(STORAGE_KEY)
      setSession(null)
    }
  }), [session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
