import { useState } from 'react';
import { useParams, NavLink, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Users, Key, User, UserPlus } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth-store';
import { auth } from '@/lib/firebase';
import type { ApiResponse, TeamMember, ApiKey } from '@sparqplug/types';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

type Section = 'organization' | 'team' | 'api-keys' | 'profile';

const NAV: { label: string; value: Section; icon: React.ElementType }[] = [
  { label: 'Organization', value: 'organization', icon: Building2 },
  { label: 'Team', value: 'team', icon: Users },
  { label: 'API Keys', value: 'api-keys', icon: Key },
  { label: 'Profile', value: 'profile', icon: User },
];

function isSection(value: string | undefined): value is Section {
  return value === 'organization' || value === 'team' || value === 'api-keys' || value === 'profile';
}

function OrganizationSection() {
  const { organization } = useAuthStore();
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Organization</h2>
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</label>
            <p className="text-sm text-foreground">{organization?.name ?? '—'}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Slug</label>
            <p className="text-sm font-mono text-foreground">{organization?.slug ?? '—'}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</label>
            <p className="text-sm text-foreground capitalize">{organization?.plan ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSection() {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'member' });

  const { data, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.get<ApiResponse<TeamMember[]>>('/settings/team'),
  });

  const inviteMutation = useMutation({
    mutationFn: (body: typeof inviteForm) => api.post('/settings/team/invite', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Invitation sent', variant: 'success' });
      setShowInvite(false);
      setInviteForm({ email: '', name: '', role: 'member' });
    },
    onError: () => toast({ title: 'Failed to send invitation', variant: 'destructive' }),
  });

  const members = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
        <button type="button" onClick={() => setShowInvite(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors" aria-label="Invite member">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Invite Member</span>
        </button>
      </div>
      <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-x-auto">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex min-w-[520px] items-center gap-3 px-5 py-4">
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="space-y-1.5 flex-1"><div className="h-4 bg-muted animate-pulse rounded w-1/3" /><div className="h-3 bg-muted animate-pulse rounded w-1/4" /></div>
            </div>
          ))
        ) : members.length === 0 ? (
          <p className="row-empty-state">No team members yet</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex min-w-[520px] items-center gap-3 px-5 py-4">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">{m.name?.[0] ?? m.email[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.name ?? m.email}</p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>
              <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
            </div>
          ))
        )}
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite} title="Invite Team Member">
        <form onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(inviteForm); }} className="space-y-3">
          <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Email *</label><input required type="email" className={inputClass} value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Name</label><input className={inputClass} value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Role</label><select aria-label="Invite member role" className={inputClass} value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}><option value="member">Member</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowInvite(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={inviteMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">{inviteMutation.isPending ? 'Sending…' : 'Send Invite'}</button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function ApiKeysSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<ApiResponse<ApiKey[]>>('/settings/api-keys'),
  });

  const createMutation = useMutation({
    mutationFn: (n: string) => api.post<ApiResponse<{ key: string; apiKey: ApiKey }>>('/settings/api-keys', { name: n }),
    onSuccess: (res) => {
      setNewKey(res.data?.key ?? null);
      setName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'API key created', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to create API key', variant: 'destructive' }),
  });

  const keys = data?.data ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
      {newKey && <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-2"><p className="text-sm font-medium text-green-600 dark:text-green-400">Key created — copy it now, it won't be shown again</p><code className="block font-mono text-xs bg-background rounded border border-border px-3 py-2 text-foreground break-all">{newKey}</code><button type="button" onClick={() => { navigator.clipboard.writeText(newKey); toast({ title: 'Copied to clipboard' }); }} className="text-xs text-primary hover:underline">Copy</button></div>}
      <div className="flex gap-2"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name" className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" /><button type="button" onClick={() => name && createMutation.mutate(name)} disabled={!name || createMutation.isPending} className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"><span className="hidden sm:inline">{createMutation.isPending ? 'Creating…' : 'Create Key'}</span><Key className="h-4 w-4 sm:hidden" /></button></div>
      <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-x-auto">
        {isLoading ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="min-w-[520px] px-5 py-4"><div className="h-4 bg-muted animate-pulse rounded w-1/3" /></div>) : keys.length === 0 ? <p className="row-empty-state">No API keys yet</p> : keys.map((k) => <div key={k.id} className="flex min-w-[520px] items-center gap-3 px-5 py-4"><Key className="h-4 w-4 text-muted-foreground shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{k.name}</p><p className="text-xs font-mono text-muted-foreground">{k.keyPrefix}••••••••</p></div><p className="text-xs text-muted-foreground whitespace-nowrap">{k.lastUsedAt ? `Last used ${formatDate(k.lastUsedAt)}` : 'Never used'}</p></div>)}
      </div>
    </div>
  );
}

function ProfileSection() {
  const { user } = useAuthStore();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const currentUser = auth.currentUser;
      if (!currentUser?.email) throw new Error('You must be signed in to change your password.');
      if (!passwordForm.currentPassword) throw new Error('Current password is required.');
      if (passwordForm.newPassword.length < 8) throw new Error('New password must be at least 8 characters.');
      if (passwordForm.newPassword !== passwordForm.confirmPassword) throw new Error('New passwords do not match.');
      if (passwordForm.newPassword === passwordForm.currentPassword) throw new Error('New password must be different from the current password.');
      const credential = EmailAuthProvider.credential(currentUser.email, passwordForm.currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordForm.newPassword);
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ title: 'Password updated', variant: 'success' });
    },
    onError: (error) => toast({ title: 'Failed to update password', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Profile</h2>
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3"><div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-5 w-5 text-primary" /></div><div><p className="font-semibold text-foreground">{user?.name}</p><p className="text-sm text-muted-foreground">{user?.email}</p><p className="text-xs text-muted-foreground capitalize mt-0.5">{user?.role}</p></div></div>
        <div className="border-t border-border pt-4 space-y-3">
          <div><h3 className="text-sm font-semibold text-foreground">Change Password</h3><p className="text-xs text-muted-foreground mt-1">Re-enter your current password before setting a new one.</p></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><div className="space-y-1.5 md:col-span-2"><label className="text-xs font-medium text-muted-foreground">Current password</label><input type="password" autoComplete="current-password" className={inputClass} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((current) => ({ ...current, currentPassword: e.target.value }))} /></div><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">New password</label><input type="password" autoComplete="new-password" className={inputClass} value={passwordForm.newPassword} onChange={(e) => setPasswordForm((current) => ({ ...current, newPassword: e.target.value }))} /></div><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Confirm new password</label><input type="password" autoComplete="new-password" className={inputClass} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((current) => ({ ...current, confirmPassword: e.target.value }))} /></div></div>
          <div className="flex justify-end"><button type="button" onClick={() => changePasswordMutation.mutate()} disabled={changePasswordMutation.isPending} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">{changePasswordMutation.isPending ? 'Updating…' : 'Update Password'}</button></div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { section } = useParams<{ section?: string }>();
  if (section === 'services') return <Navigate to="/services" replace />;
  const activeSection: Section = isSection(section) ? section : 'organization';

  const SECTION_MAP: Record<Section, React.ReactNode> = {
    organization: <OrganizationSection />,
    team: <TeamSection />,
    'api-keys': <ApiKeysSection />,
    profile: <ProfileSection />,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6"><h1 className="text-xl font-semibold text-foreground">Settings</h1></div>
      <div className="flex flex-col sm:flex-row gap-6">
        <nav className="sm:w-48 shrink-0 overflow-x-auto">
          <ul className="flex gap-1 sm:block sm:space-y-0.5">
            {NAV.map((item) => <li key={item.value} className="shrink-0"><NavLink to={`/settings/${item.value}`} className={({ isActive }) => cn('flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full whitespace-nowrap', (isActive || activeSection === item.value) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}><item.icon className="h-4 w-4 shrink-0" /><span>{item.label}</span></NavLink></li>)}
          </ul>
        </nav>
        <div className="flex-1 min-w-0">{SECTION_MAP[activeSection]}</div>
      </div>
    </div>
  );
}