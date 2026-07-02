import { cn } from '@/lib/utils';

interface SidebarBrandProps {
  collapsed?: boolean;
  actions?: React.ReactNode;
}

export function SidebarBrand({ collapsed = false, actions }: SidebarBrandProps) {
  const brandAsset = `${import.meta.env.BASE_URL}${collapsed ? 'sparqplugIcon.png' : 'sparqplugLogo.png'}`;

  return (
    <div className={cn('flex h-16 items-center border-b border-sidebar-border', collapsed ? 'relative justify-center px-2' : 'justify-between gap-3 px-3')}>
      <div className="flex min-w-0 items-center justify-center">
        <img
          src={brandAsset}
          alt="SparQPlug"
          className={cn('block object-contain', collapsed ? 'h-11 w-11' : 'h-9 w-auto max-w-[148px]')}
        />
      </div>
      {actions ? <div className={cn(collapsed ? 'absolute right-2 top-1/2 -translate-y-1/2' : 'shrink-0')}>{actions}</div> : null}
    </div>
  );
}