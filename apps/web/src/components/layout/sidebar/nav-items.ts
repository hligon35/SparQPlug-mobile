import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  PackageOpen,
  type LucideIcon,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Companies', href: '/crm/companies', icon: Building2, group: 'CRM' },
  { label: 'Contacts', href: '/crm/contacts', icon: Users, group: 'CRM' },
  { label: 'Opportunities', href: '/crm/opportunities', icon: TrendingUp, group: 'CRM' },
  { label: 'Activities', href: '/crm/activities', icon: Activity, group: 'CRM' },
  { label: 'Password Locker', href: '/crm/password-lockers', icon: KeyRound, group: 'CRM' },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Customers', href: '/billing/customers', icon: CreditCard, group: 'Billing' },
  { label: 'Invoices', href: '/billing/invoices', icon: FileText, group: 'Billing' },
  { label: 'Subscriptions', href: '/billing/subscriptions', icon: CreditCard, group: 'Billing' },
  { label: 'Services', href: '/services', icon: PackageOpen, group: 'Operations' },
  { label: 'Documents', href: '/documents', icon: FolderOpen },
  { label: 'Network Ops', href: '/network-ops', icon: ShieldCheck },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function groupNavItems(items: NavItem[]) {
  const groups: Record<string, NavItem[]> = { '': [] };

  for (const item of items) {
    const group = item.group ?? '';
    if (!groups[group]) {
      groups[group] = [];
    }

    groups[group].push(item);
  }

  return groups;
}
