import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { logout, readCurrentSession } from '@/modules/authentication/api'
import type { ModuleGrant } from '@/modules/access'

type SignedIn = {
  userId?: string
  role?: 'platform-admin' | 'owner' | 'operator'
  grants: readonly ModuleGrant[]
  companyName: string
  companyId: string
  logoUrl?: string | null
}

type SessionState = {
  userId: string | null
  role: 'platform-admin' | 'owner' | 'operator' | null
  grants: readonly ModuleGrant[] | null
  companyName: string | null
  companyId: string | null
  logoUrl: string | null
  restoring: boolean
  signIn: (next: SignedIn) => void
  signOut: () => void
}

const SessionContext = createContext<SessionState>({
  userId: null,
  role: null,
  grants: null,
  companyName: null,
  companyId: null,
  logoUrl: null,
  restoring: false,
  signIn: () => undefined,
  signOut: () => undefined,
})

type SessionProviderProps = {
  grants?: readonly ModuleGrant[] | null
  companyName?: string | null
  companyId?: string | null
  children: ReactNode
}

export function SessionProvider({ grants = null, companyName = null, companyId = null, children }: SessionProviderProps) {
  const [session, setSession] = useState({ grants, companyName, companyId, logoUrl: null as string | null, userId: null as string | null, role: null as SessionState['role'] })
  const [restoring, setRestoring] = useState(import.meta.env.MODE !== 'test' && grants === null)

  useEffect(() => {
    if (import.meta.env.MODE === 'test' || grants !== null) {
      return
    }
    let active = true
    void readCurrentSession()
      .then((next) => {
        if (!active) {
          return
        }
        if (next !== null) {
          setSession({ grants: next.grants, companyName: next.companyName, companyId: next.companyId, logoUrl: next.logoUrl, userId: next.userId ?? null, role: next.role })
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setRestoring(false)
        }
      })
    return () => {
      active = false
    }
  }, [grants])

  function signIn(next: SignedIn) {
    setSession({ grants: next.grants, companyName: next.companyName, companyId: next.companyId, logoUrl: next.logoUrl ?? null, userId: next.userId ?? null, role: next.role ?? null })
  }

  function signOut() {
    void logout()
    setSession({ grants: null, companyName: null, companyId: null, logoUrl: null, userId: null, role: null })
  }

  return <SessionContext.Provider value={{ ...session, restoring, signIn, signOut }}>{children}</SessionContext.Provider>
}

export function useSession(): SessionState {
  return useContext(SessionContext)
}
