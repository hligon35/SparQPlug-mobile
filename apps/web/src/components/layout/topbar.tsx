import { Search, Bell, Sun, Moon, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useTheme } from '@/providers/theme-provider';
import { cn } from '@/lib/utils';

export function Topbar() {
  const { user, signOut: clearAuth } = useAuthStore();
  const { setCommandPaletteOpen } = useUIStore();
  const { theme, setTheme } = useTheme();

  async function handleSignOut() {
    await signOut(auth);
    clearAuth();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-4 gap-4">
      {/* Search trigger */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex items-center gap-2 h-9 w-full max-w-sm rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Search or jump to…</span>
        <kbd className="ml-auto font-mono text-[10px] bg-background border border-border rounded px-1.5 py-0.5 text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <button
          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
