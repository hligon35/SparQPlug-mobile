import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '@sparqplug/types';

interface UIState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  sidebarIconOnly: boolean;
  commandPaletteOpen: boolean;
  activePanel: string | null;

  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  setSidebarIconOnly: (iconOnly: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActivePanel: (panel: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      sidebarIconOnly: false,
      commandPaletteOpen: false,
      activePanel: null,

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarIconOnly: (sidebarIconOnly) => set({ sidebarIconOnly }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      setActivePanel: (activePanel) => set({ activePanel }),
    }),
    {
      name: 'sparqplug-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarIconOnly: state.sidebarIconOnly,
      }),
    },
  ),
);
