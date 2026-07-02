import { Search, Bell, Sun, Moon, LogOut, Menu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useTheme } from '@/providers/theme-provider';
import type { ApiResponse, Notification } from '@sparqplug/types';

export function Topbar() {
  const navigate = useNavigate();
  const { user, signOut: clearAuth } = useAuthStore();
  const { setCommandPaletteOpen, setMobileSidebarOpen } = useUIStore();
  const { theme, setTheme } = useTheme();
  const { data } = useQuery({
    queryKey: ['notifications', 'topbar'],
    queryFn: () => api.get<ApiResponse<Notification[]>>('/notifications'),
  });

  const unreadCount = (data?.data ?? []).filter((item) => !item.isRead).length;

  async function handleSignOut() {
    await signOut(auth);
    clearAuth();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur-sm sm:px-4">
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:max-w-xl"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search or jump to…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />}
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={user?.name ? `Sign out ${user.name}` : 'Sign out'}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
