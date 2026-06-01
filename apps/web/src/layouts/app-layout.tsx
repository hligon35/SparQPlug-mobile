import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPalette } from '@/components/layout/command-palette';
import { useUIStore } from '@/stores/ui-store';
import { useEffect } from 'react';

export function AppLayout() {
  const { sidebarCollapsed, setCommandPaletteOpen } = useUIStore();

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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />

        <main
          className="flex-1 overflow-auto"
          role="main"
          aria-label="Main content"
        >
          <div className="h-full animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
