import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SidebarBrand } from './sidebar-brand';
import { SidebarNav } from './sidebar-nav';
import { SidebarUser } from './sidebar-user';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';

export function DesktopSidebar() {
  const { sidebarCollapsed, sidebarIconOnly, toggleSidebar } = useUIStore();
  const collapsed = sidebarCollapsed || sidebarIconOnly;

  return (
    <aside
      className={cn(
        'hidden min-h-dvh border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out lg:flex lg:flex-col',
        collapsed ? 'lg:w-[72px]' : 'lg:w-[220px]',
      )}
    >
      <SidebarBrand
        collapsed={collapsed}
        actions={
          !sidebarIconOnly ? (
            <button
              onClick={toggleSidebar}
              className="ml-auto rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          ) : undefined
        }
      />
      <SidebarNav collapsed={collapsed} />
      <SidebarUser collapsed={collapsed} />
    </aside>
  );
}