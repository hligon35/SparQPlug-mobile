import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Search, LayoutDashboard, Users, Building2, TrendingUp, BarChart3, FileText, FolderOpen, Settings, CreditCard, KeyRound, ShieldCheck } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

interface CommandItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group: string;
}

const COMMANDS: CommandItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, group: 'Navigation' },
  { label: 'Contacts', href: '/crm/contacts', icon: Users, group: 'CRM' },
  { label: 'Companies', href: '/crm/companies', icon: Building2, group: 'CRM' },
  { label: 'Opportunities', href: '/crm/opportunities', icon: TrendingUp, group: 'CRM' },
  { label: 'Password Locker', href: '/crm/password-lockers', icon: KeyRound, group: 'CRM' },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, group: 'Navigation' },
  { label: 'Invoices', href: '/billing/invoices', icon: FileText, group: 'Billing' },
  { label: 'Subscriptions', href: '/billing/subscriptions', icon: CreditCard, group: 'Billing' },
  { label: 'Documents', href: '/documents', icon: FolderOpen, group: 'Navigation' },
  { label: 'Network Ops', href: '/network-ops', icon: ShieldCheck, group: 'Navigation' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'Navigation' },
];

const GROUPS = ['Navigation', 'CRM', 'Billing'];

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!commandPaletteOpen) setQuery('');
  }, [commandPaletteOpen]);

  function handleSelect(href: string) {
    navigate(href);
    setCommandPaletteOpen(false);
  }

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => setCommandPaletteOpen(false)}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <div className="flex items-center border-b border-border px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, contacts, documents…"
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="text-[10px] font-mono bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {GROUPS.map((group) => {
              const items = COMMANDS.filter((c) => c.group === group);
              return (
                <Command.Group key={group} heading={group}>
                  {items.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      onSelect={() => handleSelect(item.href)}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer',
                        'text-foreground hover:bg-accent',
                        'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
                      )}
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
