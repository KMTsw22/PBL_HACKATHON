import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type NavVisibilityContextValue = {
  hideNav: boolean
  setHideNav: (hide: boolean) => void
}

const NavVisibilityContext = createContext<NavVisibilityContextValue | null>(null)

export function NavVisibilityProvider({ children }: { children: ReactNode }) {
  const [hideNav, setHideNavState] = useState(false)
  const setHideNav = useCallback((hide: boolean) => setHideNavState(hide), [])
  return (
    <NavVisibilityContext.Provider value={{ hideNav, setHideNav }}>
      {children}
    </NavVisibilityContext.Provider>
  )
}

export function useNavVisibility() {
  const ctx = useContext(NavVisibilityContext)
  return ctx ?? { hideNav: false, setHideNav: () => {} }
}
