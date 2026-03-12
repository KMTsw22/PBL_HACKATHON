import { NavLink, Outlet } from 'react-router-dom'
import { useNavVisibility } from '@/contexts/NavVisibilityContext'
import { HomeIcon, CollectIcon, FindIcon, MessagesIcon, AskIcon, SettingsIcon } from './NavIcons'

const navItems = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/collect', label: 'Collect', Icon: CollectIcon },
  { to: '/find', label: 'Find', Icon: FindIcon },
  { to: '/ask', label: 'Ask', Icon: AskIcon },
  { to: '/chats', label: 'Messages', Icon: MessagesIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export default function Layout({ children }: { children?: React.ReactNode }) {
  const { hideNav } = useNavVisibility()
  const showNav = !hideNav

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F6]">
      <main className={`flex-1 min-h-0 overflow-y-auto ${showNav ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]' : 'pb-4'}`}>
        {children ?? <Outlet />}
      </main>
      {showNav && (
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-14 min-h-[56px] bg-[#F8F8F8] border-t border-gray-200 flex justify-around items-center py-2 safe-area-pb shadow-[0_-1px_6px_rgba(0,0,0,0.06)]">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to} 
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[10px] font-medium uppercase ${isActive ? 'text-[#FF9C8F]' : 'text-gray-500'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      )}
    </div>
  )
}
