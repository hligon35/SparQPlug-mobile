import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  TrendingUp,
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  FolderOpen,
  KeyRound,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { getInitials } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Contacts', href: '/crm/contacts', icon: Users, group: 'CRM' },
  { label: 'Companies', href: '/crm/companies', icon: Building2, group: 'CRM' },
  { label: 'Opportunities', href: '/crm/opportunities', icon: TrendingUp, group: 'CRM' },
  { label: 'Activities', href: '/crm/activities', icon: Activity, group: 'CRM' },
  { label: 'Password Locker', href: '/crm/password-lockers', icon: KeyRound, group: 'CRM' },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Customers', href: '/billing/customers', icon: CreditCard, group: 'Billing' },
  { label: 'Invoices', href: '/billing/invoices', icon: FileText, group: 'Billing' },
  { label: 'Subscriptions', href: '/billing/subscriptions', icon: CreditCard, group: 'Billing' },
  { label: 'Documents', href: '/documents', icon: FolderOpen },
  { label: 'Settings', href: '/settings', icon: Settings },
];

function groupNavItems(items: NavItem[]) {
  const groups: Record<string, NavItem[]> = { '': [] };
  for (const item of items) {
    const g = item.group ?? '';
    if (!groups[g]) groups[g] = [];
    groups[g]!.push(item);
  }
  return groups;
}

export function Sidebar() {
  const { sidebarCollapsed, sidebarIconOnly, toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  const location = useLocation();
  const collapsed = sidebarCollapsed || sidebarIconOnly;
  const groups = groupNavItems(NAV_ITEMS);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out',
        collapsed ? 'w-[60px]' : 'w-[220px]',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="font-bold text-sidebar-foreground truncate">SparQPlug</span>
          </div>
        )}
        {collapsed && (
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-white text-xs font-bold">S</span>
          </div>
        )}
        {!sidebarIconOnly && (
          <button
            onClick={toggleSidebar}
            className="ml-auto rounded-md p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            {group && !collapsed && (
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {group}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                        'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                        isActive && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
                        collapsed && 'justify-center',
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-2">
        <div className={cn('flex items-center gap-2 rounded-md px-2 py-2', collapsed && 'justify-center')}>
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-primary text-xs font-semibold">
              {user?.name ? getInitials(user.name) : '??'}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.name}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.role}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
