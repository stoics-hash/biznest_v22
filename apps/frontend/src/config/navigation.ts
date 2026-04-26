import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Map,
  Building2,
  CreditCard,
  Bookmark,
  Bell,
  Database,
  ScrollText,
  Settings,
  Users,
  ShieldCheck,
} from 'lucide-react'

export type NavItem = {
  title: string
  to: string
  icon: LucideIcon
}

export type NavSection = {
  title?: string
  items: NavItem[]
}

export const investorNavSections: NavSection[] = [
  {
    items: [
      { title: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { title: 'Cities', to: '/cities', icon: Building2 },
      { title: 'Map', to: '/map', icon: Map },
      { title: 'Subscription', to: '/subscriptions', icon: CreditCard },
      { title: 'Saved Locations', to: '/saved-locations', icon: Bookmark },
    ],
  },
]

export const lguNavSections: NavSection[] = [
  {
    items: [
      { title: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { title: 'Cities', to: '/cities', icon: Building2 },
      { title: 'Map', to: '/map', icon: Map },
      { title: 'Alerts', to: '/alerts', icon: Bell },
      { title: 'Data', to: '/data', icon: Database },
    ],
  },
  {
    title: 'System',
    items: [
      { title: 'Audit Logs', to: '/audit-logs', icon: ScrollText },
      { title: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

export const defaultNavSections: NavSection[] = [
  {
    items: [
      { title: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { title: 'Cities', to: '/cities', icon: Building2 },
      { title: 'Map', to: '/map', icon: Map },
    ],
  },
]

export const administrationNavSections: NavSection[] = [
  {
    title: 'Administration',
    items: [
      { title: 'User Management', to: '/admin/user-management', icon: Users },
      { title: 'Role & Permissions', to: '/admin/role-permissions', icon: ShieldCheck },
    ],
  },
]

export { Map as BrandIcon }
