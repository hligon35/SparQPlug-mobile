import { cn } from '@/lib/utils';

interface SidebarBrandProps {
  collapsed?: boolean;
  actions?: React.ReactNode;
}

export function SidebarBrand({ collapsed = false, actions }: SidebarBrandProps) {
  const brandAsset = `${import.meta.env.BASE_URL}${collapsed ? 'sparqplugIcon.png' : 'sparqplugLogo.png'}`;

  return (
    <div className="flex h-16 items-center justify-between gap-3 border-b border-sidebar-border px-3">
      <div className="flex min-w-0 items-center">
        <img
          src={brandAsset}
          alt="SparQPlug"
          className={cn('block object-contain', collapsed ? 'h-9 w-9' : 'h-9 w-auto max-w-[148px]')}
        />
      </div>
      {actions}
    </div>
  );
}