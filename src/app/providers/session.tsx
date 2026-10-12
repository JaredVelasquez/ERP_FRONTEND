import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { readCurrentSession } from '@/modules/authentication/api'
import type { ModuleGrant } from '@/modules/access'

type SignedIn = {
  grants: readonly ModuleGrant[]
  companyName: string
  companyId: string
  logoUrl?: string | null
}

type SessionState = {
  grants: readonly ModuleGrant[] | null
  companyName: string | null
  companyId: string | null
  logoUrl: string | null
  restoring: boolean
  signIn: (next: SignedIn) => void
  signOut: () => void
}

const SessionContext = createContext<SessionState>({
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
  const [session, setSession] = useState({ grants, companyName, companyId, logoUrl: null as string | null })
  const [restoring, setRestoring] = useState(import.meta.env.MODE !== 'test' && grants === null)

  useEffect(() => {
    if (import.meta.env.MODE === 'test' || grants !== null) {
      return
    }
    let active = true
    void readCurrentSession().then((next) => {
      if (!active) {
        return
      }
      if (next !== null) {
        setSession({ grants: next.grants, companyName: next.companyName, companyId: next.companyId, logoUrl: next.logoUrl })
      }
      setRestoring(false)
    })
    return () => {
      active = false
    }
  }, [grants])

  function signIn(next: SignedIn) {
    setSession({ grants: next.grants, companyName: next.companyName, companyId: next.companyId, logoUrl: next.logoUrl ?? null })
  }

  function signOut() {
    setSession({ grants: null, companyName: null, companyId: null, logoUrl: null })
  }

  return <SessionContext.Provider value={{ ...session, restoring, signIn, signOut }}>{children}</SessionContext.Provider>
}

export function useSession(): SessionState {
  return useContext(SessionContext)
}
