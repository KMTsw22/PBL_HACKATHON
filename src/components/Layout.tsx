import { NavLink, Outlet } from 'react-router-dom'
import { HomeIcon, CollectIcon, FindIcon, MessagesIcon, AskIcon, SettingsIcon } from './NavIcons'

const navItems = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/collect', label: 'Collect', Icon: CollectIcon },
  { to: '/find', label: 'Find', Icon: FindIcon },
  { to: '/chats', label: 'Messages', Icon: MessagesIcon },
  { to: '/ask', label: 'Ask', Icon: AskIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export default function Layout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF8F6] pb-20">
      <main>{children ?? <Outlet />}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 safe-area-pb">
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
    </div>
  )
}
