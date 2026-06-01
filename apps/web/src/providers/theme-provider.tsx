import { createContext, useContext, useEffect } from 'react';
import { useUIStore } from '@/stores/ui-store';
import type { ThemeMode } from '@sparqplug/types';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  storageKey?: string;
}

const ThemeContext = createContext<{
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}>({ theme: 'dark', setTheme: () => undefined });

export function ThemeProvider({ children, defaultTheme = 'dark' }: ThemeProviderProps) {
  const { theme, setTheme } = useUIStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    const resolvedTheme =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;

    root.classList.add(resolvedTheme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
