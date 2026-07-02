import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, groupNavItems } from './nav-items';
import { cn } from '@/lib/utils';

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const groups = groupNavItems(NAV_ITEMS);

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Primary navigation">
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
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-md px-2 py-2.5 text-sm font-medium transition-colors',
                      'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      isActive &&
                        'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
                      collapsed && 'justify-center px-0 py-3',
                    )
                  }
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                >
                  <item.icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}