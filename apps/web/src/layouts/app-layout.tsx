import { Outlet } from 'react-router-dom';
import { DesktopSidebar } from '@/components/layout/sidebar/desktop-sidebar';
import { MobileSidebarDrawer } from '@/components/layout/sidebar/mobile-sidebar-drawer';
import { Topbar } from '@/components/layout/topbar';
import { CommandPalette } from '@/components/layout/command-palette';
import { useUIStore } from '@/stores/ui-store';
import { useEffect } from 'react';

export function AppLayout() {
  const { setCommandPaletteOpen } = useUIStore();

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen]);

  return (
    <div className="flex min-h-dvh bg-background">
      <DesktopSidebar />
      <MobileSidebarDrawer />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main
          className="flex-1 overflow-x-hidden overflow-y-auto"
          role="main"
          aria-label="Main content"
        >
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="min-h-full animate-fade-in">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
