import { useAuthStore } from '@/stores/auth-store';
import { cn, getInitials } from '@/lib/utils';

interface SidebarUserProps {
  collapsed?: boolean;
}

export function SidebarUser({ collapsed = false }: SidebarUserProps) {
  const { user } = useAuthStore();

  return (
    <div className="border-t border-sidebar-border p-2">
      <div className={cn('flex items-center gap-2 rounded-md px-2 py-2', collapsed && 'justify-center')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <span className="text-xs font-semibold text-primary">
            {user?.name ? getInitials(user.name) : '??'}
          </span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">{user?.name}</p>
            <p className="truncate text-[10px] text-sidebar-foreground/50">{user?.role}</p>
          </div>
        )}
      </div>
    </div>
  );
}