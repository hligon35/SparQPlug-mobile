import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { SidebarBrand } from './sidebar-brand';
import { SidebarNav } from './sidebar-nav';
import { SidebarUser } from './sidebar-user';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';

export function MobileSidebarDrawer() {
  const { pathname } = useLocation();
  const { mobileSidebarOpen, closeMobileSidebar } = useUIStore();

  useEffect(() => {
    if (!mobileSidebarOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeMobileSidebar, mobileSidebarOpen]);

  useEffect(() => {
    if (mobileSidebarOpen) {
      closeMobileSidebar();
    }
  }, [pathname]);

  return (
    <div
      className={cn('fixed inset-0 z-40 lg:hidden', !mobileSidebarOpen && 'pointer-events-none')}
    >
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity',
          mobileSidebarOpen ? 'opacity-100' : 'opacity-0',
        )}
        onClick={closeMobileSidebar}
        aria-label="Close navigation menu"
      />

      <aside
        className={cn(
          'absolute inset-y-0 left-0 flex w-[min(85vw,20rem)] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-200 ease-out',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <SidebarBrand
          actions={
            <button
              type="button"
              onClick={closeMobileSidebar}
              className="ml-auto rounded-md p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          }
        />
        <SidebarNav onNavigate={closeMobileSidebar} />
        <SidebarUser />
      </aside>
    </div>
  );
}