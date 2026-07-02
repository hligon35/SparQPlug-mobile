import { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import { api } from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Contact,
  Company,
  PasswordLocker,
  PasswordLockerService,
  PasswordReveal,
  ContactInput,
  CompanyInput,
} from '@sparqplug/types';

const COLORS = {
  bg: '#0a0f1e',
  card: '#111827',
  border: '#1e2a3a',
  text: '#f8fafc',
  muted: '#94a3b8',
  primary: '#3b82f6',
  success: '#22c55e',
  danger: '#ef4444',
};

const URL_PREFIX = 'https://';

const SERVICES: Array<{ value: PasswordLockerService; label: string }> = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'other', label: 'Other' },
];

type TabView = 'contacts' | 'lockers';

type LockerForm = {
  label: string;
  service: PasswordLockerService;
  username: string;
  accountEmail: string;
  loginUrl: string;
  password: string;
  notes: string;
};

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  status: ContactInput['status'];
  companyId: string;
};

type CompanyForm = {
  name: string;
  industry: string;
  website: string;
  size: NonNullable<CompanyInput['size']> | '';
  status: CompanyInput['status'];
};

const EMPTY_FORM: LockerForm = {
  label: '',
  service: 'other',
  username: '',
  accountEmail: '',
  loginUrl: '',
  password: '',
  notes: '',
};

const EMPTY_CONTACT_FORM: ContactForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  title: '',
  status: 'lead',
  companyId: '',
};

const EMPTY_COMPANY_FORM: CompanyForm = {
  name: '',
  industry: '',
  website: '',
  size: '',
  status: 'prospect',
};

const CONTACT_STATUSES: Array<ContactInput['status']> = ['lead', 'active', 'prospect', 'customer', 'inactive'];
const COMPANY_STATUSES: Array<CompanyInput['status']> = ['prospect', 'active', 'customer', 'inactive', 'churned'];
const COMPANY_SIZES: Array<NonNullable<CompanyInput['size']>> = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

type PasswordLockersListResponse = ApiResponse<PasswordLocker[]> & {
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
};

function maskPassword(value: string): string {
  if (!value) return '••••••••';
  return '•'.repeat(Math.min(Math.max(value.length, 8), 16));
}

function trimOrUndefined(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function prefillUrlField(value: string) {
  return value.trim() === '' ? URL_PREFIX : value;
}

function normalizeUrlField(value: string | null | undefined) {
  const trimmed = trimOrUndefined(value);

  if (!trimmed || trimmed === URL_PREFIX || trimmed === 'http://') {
    return undefined;
  }

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `${URL_PREFIX}${trimmed.replace(/^\/+/, '')}`;
}

function formatPhoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const digits = trimmed.replace(/\D/g, '');
  const hasPlusPrefix = trimmed.startsWith('+');

  if (!digits) {
    return hasPlusPrefix ? '+' : '';
  }

  const isUsNumber = digits.length <= 10 || (digits.length === 11 && digits.startsWith('1'));
  if (isUsNumber) {
    const countryCode = digits.length === 11 ? '1' : '';
    const nationalDigits = countryCode ? digits.slice(1) : digits;
    const area = nationalDigits.slice(0, 3);
    const prefix = nationalDigits.slice(3, 6);
    const line = nationalDigits.slice(6, 10);

    let formatted = '';
    if (countryCode) {
      formatted += `+${countryCode} `;
    }
    if (area) {
      formatted += area.length < 3 ? `(${area}` : `(${area})`;
    }
    if (prefix) {
      formatted += area.length === 3 ? ` ${prefix}` : prefix;
    }
    if (line) {
      formatted += `-${line}`;
    }

    return formatted;
  }

  return hasPlusPrefix ? `+${digits}` : digits;
}

function getItems<T>(response?: ApiResponse<PaginatedResponse<T>> | ApiResponse<T[]>): T[] {
  if (!response?.data) return [];

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return response.data.items ?? response.data.data ?? [];
}

export default function CRMScreen() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabView>('contacts');
  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<PasswordLocker | null>(null);
  const [form, setForm] = useState<LockerForm>(EMPTY_FORM);
  const [revealedById, setRevealedById] = useState<Record<string, string>>({});
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null);
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [companyTargetContact, setCompanyTargetContact] = useState<Contact | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [contactFormVisible, setContactFormVisible] = useState(false);
  const [companyCreateVisible, setCompanyCreateVisible] = useState(false);
  const [contactForm, setContactForm] = useState<ContactForm>(EMPTY_CONTACT_FORM);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(EMPTY_COMPANY_FORM);

  const { data: contactsData, isLoading: contactsLoading } = useQuery<ApiResponse<PaginatedResponse<Contact>>>({
    queryKey: ['contacts', { page: 1 }],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Contact>>>('/contacts', { limit: 30 }),
  });

  const { data: lockersData, isLoading: lockersLoading } = useQuery<PasswordLockersListResponse>({
    queryKey: ['password-lockers', { page: 1, search }],
    queryFn: () =>
      api.get<PasswordLockersListResponse>('/password-lockers', {
        page: 1,
        limit: 50,
        search: search || undefined,
      }),
  });

  const { data: companiesData } = useQuery<ApiResponse<PaginatedResponse<Company>>>({
    queryKey: ['companies', { page: 1 }],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Company>>>('/companies', { page: 1, limit: 200 }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: LockerForm) =>
      api.post('/password-lockers', {
        label: payload.label.trim(),
        service: payload.service,
        username: payload.username.trim() || null,
        accountEmail: payload.accountEmail.trim() || null,
        loginUrl: normalizeUrlField(payload.loginUrl) ?? null,
        password: payload.password,
        notes: payload.notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['password-lockers'] });
      setFormVisible(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      Alert.alert('Saved', 'Password locker entry created.');
    },
    onError: () => Alert.alert('Error', 'Could not create password entry.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LockerForm }) =>
      api.patch(`/password-lockers/${id}`, {
        label: payload.label.trim(),
        service: payload.service,
        username: payload.username.trim() || null,
        accountEmail: payload.accountEmail.trim() || null,
        loginUrl: normalizeUrlField(payload.loginUrl) ?? null,
        notes: payload.notes.trim() || null,
        ...(payload.password ? { password: payload.password } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['password-lockers'] });
      setFormVisible(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      Alert.alert('Saved', 'Password locker entry updated.');
    },
    onError: () => Alert.alert('Error', 'Could not update password entry.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/password-lockers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['password-lockers'] });
      Alert.alert('Deleted', 'Password locker entry deleted.');
    },
    onError: () => Alert.alert('Error', 'Could not delete password entry.'),
  });

  const revealMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<ApiResponse<PasswordReveal>>(`/password-lockers/${id}/reveal`, {});
      return response.data?.password ?? '';
    },
  });

  const contacts = getItems<Contact>(contactsData);
  const companies = getItems<Company>(companiesData);
  const lockers = lockersData?.data ?? [];

  const updateContactCompanyMutation = useMutation({
    mutationFn: ({ contactId, companyId }: { contactId: string; companyId: string | null }) =>
      api.patch(`/contacts/${contactId}`, { companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setCompanyModalVisible(false);
      setCompanyTargetContact(null);
      setSelectedCompanyId('');
      Alert.alert('Saved', 'Contact relationship updated.');
    },
    onError: () => Alert.alert('Error', 'Could not update contact company.'),
  });

  const createContactMutation = useMutation({
    mutationFn: (payload: ContactForm) =>
      api.post('/contacts', {
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        email: payload.email.trim() || null,
        phone: formatPhoneInput(payload.phone).trim() || null,
        title: payload.title.trim() || null,
        companyId: payload.companyId || null,
        status: payload.status,
        tags: [],
        customFields: {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setContactFormVisible(false);
      setContactForm(EMPTY_CONTACT_FORM);
      Alert.alert('Saved', 'Contact created successfully.');
    },
    onError: (error) => Alert.alert('Error', getErrorMessage(error, 'Could not create contact.')),
  });

  const createCompanyMutation = useMutation({
    mutationFn: (payload: CompanyForm) =>
      api.post('/companies', {
        name: payload.name.trim(),
        industry: payload.industry.trim() || null,
        website: normalizeUrlField(payload.website) ?? null,
        size: payload.size || null,
        status: payload.status,
        tags: [],
        customFields: {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setCompanyCreateVisible(false);
      setCompanyForm(EMPTY_COMPANY_FORM);
      Alert.alert('Saved', 'Company created successfully.');
    },
    onError: (error) => Alert.alert('Error', getErrorMessage(error, 'Could not create company.')),
  });

  const canUseBiometric = useMemo(() => unlockedAt != null && Date.now() - unlockedAt < 120000, [unlockedAt]);

  async function ensureBiometric(): Promise<boolean> {
    if (canUseBiometric) return true;

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      Alert.alert('Biometric Unavailable', 'No biometric method is configured on this device.');
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Password Locker',
      disableDeviceFallback: false,
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
    });

    if (!result.success) return false;
    setUnlockedAt(Date.now());
    return true;
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  }

  function openCreateContact() {
    setContactForm(EMPTY_CONTACT_FORM);
    setContactFormVisible(true);
  }

  function openCreateCompany() {
    setCompanyForm(EMPTY_COMPANY_FORM);
    setCompanyCreateVisible(true);
  }

  function openCompanyLink(contact: Contact) {
    setCompanyTargetContact(contact);
    setSelectedCompanyId(contact.companyId ?? '');
    setCompanyModalVisible(true);
  }

  function saveCompanyLink() {
    if (!companyTargetContact) return;
    updateContactCompanyMutation.mutate({
      contactId: companyTargetContact.id,
      companyId: selectedCompanyId || null,
    });
  }

  function openEdit(locker: PasswordLocker) {
    setEditing(locker);
    setForm({
      label: locker.label,
      service: locker.service,
      username: locker.username ?? '',
      accountEmail: locker.accountEmail ?? '',
      loginUrl: locker.loginUrl ?? '',
      password: '',
      notes: locker.notes ?? '',
    });
    setFormVisible(true);
  }

  async function revealPassword(lockerId: string) {
    const allowed = await ensureBiometric();
    if (!allowed) return;

    if (revealedById[lockerId]) {
      setRevealedById((prev) => {
        const next = { ...prev };
        delete next[lockerId];
        return next;
      });
      return;
    }

    try {
      const value = await revealMutation.mutateAsync(lockerId);
      if (!value) return;

      setRevealedById((prev) => ({ ...prev, [lockerId]: value }));
      setTimeout(() => {
        setRevealedById((prev) => {
          const next = { ...prev };
          delete next[lockerId];
          return next;
        });
      }, 20000);
    } catch {
      Alert.alert('Error', 'Could not reveal password.');
    }
  }

  async function copyPassword(lockerId: string) {
    const allowed = await ensureBiometric();
    if (!allowed) return;

    try {
      let value = revealedById[lockerId];
      if (!value) {
        value = await revealMutation.mutateAsync(lockerId);
      }
      if (!value) return;

      await Clipboard.setStringAsync(value);
      Alert.alert('Copied', 'Password copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Could not copy password.');
    }
  }

  function submitForm() {
    if (!form.label.trim()) {
      Alert.alert('Required', 'Label is required.');
      return;
    }
    if (!editing && !form.password) {
      Alert.alert('Required', 'Password is required.');
      return;
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function submitContactForm() {
    if (!contactForm.firstName.trim() || !contactForm.lastName.trim()) {
      Alert.alert('Required', 'First and last name are required.');
      return;
    }

    createContactMutation.mutate(contactForm);
  }

  function submitCompanyForm() {
    if (!companyForm.name.trim()) {
      Alert.alert('Required', 'Company name is required.');
      return;
    }

    createCompanyMutation.mutate(companyForm);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>CRM</Text>
        <Text style={styles.subheading}>Contacts and secured password lockers</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'contacts' && styles.tabBtnActive]}
          onPress={() => setTab('contacts')}
        >
          <Text style={[styles.tabText, tab === 'contacts' && styles.tabTextActive]}>Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'lockers' && styles.tabBtnActive]}
          onPress={() => setTab('lockers')}
        >
          <Text style={[styles.tabText, tab === 'lockers' && styles.tabTextActive]}>Password Locker</Text>
        </TouchableOpacity>
      </View>

      {tab === 'contacts' && (
        <>
          <View style={styles.crmToolsRow}>
            <Pressable style={[styles.secondaryButton, styles.crmActionButton]} onPress={openCreateCompany}>
              <Text style={styles.secondaryButtonText}>+ Company</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.crmActionButton]} onPress={openCreateContact}>
              <Text style={styles.primaryButtonText}>+ Contact</Text>
            </Pressable>
          </View>

          {contactsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
          ) : (
            <FlatList<Contact>
              data={contacts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.firstName[0]}{item.lastName[0]}</Text>
                  </View>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemName}>{item.firstName} {item.lastName}</Text>
                    <Text style={styles.itemSub}>{item.email}</Text>
                    <Text style={styles.itemSub}>Company: {item.company?.name ?? 'Unassigned'}</Text>
                  </View>
                  <View style={styles.contactActionCol}>
                    <TouchableOpacity onPress={() => openCompanyLink(item)}>
                      <Text style={styles.actionLink}>Link Co</Text>
                    </TouchableOpacity>
                    <View style={[styles.badge, item.status === 'active' ? styles.badgeActive : styles.badgeMuted]}>
                      <Text style={styles.badgeText}>{item.status}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No contacts found</Text>}
            />
          )}
        </>
      )}

      {tab === 'lockers' && (
        <>
          <View style={styles.lockerToolsRow}>
            <View style={styles.searchWrap}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search service or account"
                placeholderTextColor={COLORS.muted}
                style={styles.searchInput}
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={openCreate}>
              <Text style={styles.primaryButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {lockersLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
          ) : (
            <FlatList<PasswordLocker>
              data={lockers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const visiblePassword = revealedById[item.id];
                return (
                  <View style={styles.item}>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemName}>{item.label}</Text>
                      <Text style={styles.itemSub}>{item.username ?? item.accountEmail ?? serviceLabel(item.service)}</Text>
                      <Text style={styles.passwordText}>{visiblePassword ?? maskPassword(item.label)}</Text>
                    </View>
                    <View style={styles.actionCol}>
                      <TouchableOpacity onPress={() => { void revealPassword(item.id); }}>
                        <Text style={styles.actionLink}>{visiblePassword ? 'Hide' : 'Peek'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { void copyPassword(item.id); }}>
                        <Text style={styles.actionLink}>Copy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openEdit(item)}>
                        <Text style={styles.actionLink}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert('Delete Entry', `Delete ${item.label}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => deleteMutation.mutate(item.id),
                            },
                          ]);
                        }}
                      >
                        <Text style={[styles.actionLink, { color: COLORS.danger }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>No password entries found</Text>}
            />
          )}
        </>
      )}

      <Modal visible={formVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Password Entry' : 'New Password Entry'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.field}
                placeholder="Label (required)"
                placeholderTextColor={COLORS.muted}
                value={form.label}
                onChangeText={(value) => setForm((prev) => ({ ...prev, label: value }))}
              />

              <Text style={styles.sectionLabel}>Service</Text>
              <View style={styles.serviceWrap}>
                {SERVICES.map((service) => {
                  const active = form.service === service.value;
                  return (
                    <TouchableOpacity
                      key={service.value}
                      onPress={() => setForm((prev) => ({ ...prev, service: service.value }))}
                      style={[styles.serviceChip, active && styles.serviceChipActive]}
                    >
                      <Text style={[styles.serviceChipText, active && styles.serviceChipTextActive]}>{service.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.field}
                placeholder="Username"
                placeholderTextColor={COLORS.muted}
                value={form.username}
                onChangeText={(value) => setForm((prev) => ({ ...prev, username: value }))}
                autoComplete="username"
                textContentType="username"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.field}
                placeholder="Account email"
                placeholderTextColor={COLORS.muted}
                value={form.accountEmail}
                onChangeText={(value) => setForm((prev) => ({ ...prev, accountEmail: value }))}
                autoComplete="email"
                textContentType="emailAddress"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.field}
                placeholder="Login URL"
                placeholderTextColor={COLORS.muted}
                value={form.loginUrl}
                onFocus={() => setForm((prev) => ({ ...prev, loginUrl: prefillUrlField(prev.loginUrl) }))}
                onChangeText={(value) => setForm((prev) => ({ ...prev, loginUrl: value }))}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.field}
                placeholder={editing ? 'Password (optional for edit)' : 'Password (required)'}
                placeholderTextColor={COLORS.muted}
                value={form.password}
                onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))}
                autoComplete="password"
                textContentType="password"
                secureTextEntry
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.field, styles.multiline]}
                placeholder="Notes"
                placeholderTextColor={COLORS.muted}
                value={form.notes}
                onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
                multiline
              />

              <Text style={styles.helperText}>
                Revealing or copying passwords requires biometric authentication.
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => {
                  setFormVisible(false);
                  setEditing(null);
                  setForm(EMPTY_FORM);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={submitForm}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editing
                      ? 'Save'
                      : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={companyModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Link Contact to Company</Text>
            <Text style={styles.helperText}>
              {companyTargetContact
                ? `${companyTargetContact.firstName} ${companyTargetContact.lastName}`
                : 'Select a contact'}
            </Text>

            <ScrollView style={styles.companyList}>
              <TouchableOpacity
                style={[styles.companyOption, selectedCompanyId === '' && styles.companyOptionActive]}
                onPress={() => setSelectedCompanyId('')}
              >
                <Text style={[styles.companyOptionText, selectedCompanyId === '' && styles.companyOptionTextActive]}>
                  No company
                </Text>
              </TouchableOpacity>

              {companies.map((company: Company) => {
                const active = selectedCompanyId === company.id;
                return (
                  <TouchableOpacity
                    key={company.id}
                    style={[styles.companyOption, active && styles.companyOptionActive]}
                    onPress={() => setSelectedCompanyId(company.id)}
                  >
                    <Text style={[styles.companyOptionText, active && styles.companyOptionTextActive]}>
                      {company.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => {
                  setCompanyModalVisible(false);
                  setCompanyTargetContact(null);
                  setSelectedCompanyId('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={saveCompanyLink}
                disabled={updateContactCompanyMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>
                  {updateContactCompanyMutation.isPending ? 'Saving...' : 'Save Relationship'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={contactFormVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Contact</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.field}
                placeholder="First name"
                placeholderTextColor={COLORS.muted}
                value={contactForm.firstName}
                onChangeText={(value) => setContactForm((prev) => ({ ...prev, firstName: value }))}
              />
              <TextInput
                style={styles.field}
                placeholder="Last name"
                placeholderTextColor={COLORS.muted}
                value={contactForm.lastName}
                onChangeText={(value) => setContactForm((prev) => ({ ...prev, lastName: value }))}
              />
              <TextInput
                style={styles.field}
                placeholder="Email"
                placeholderTextColor={COLORS.muted}
                value={contactForm.email}
                onChangeText={(value) => setContactForm((prev) => ({ ...prev, email: value }))}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.field}
                placeholder="Phone"
                placeholderTextColor={COLORS.muted}
                value={contactForm.phone}
                onChangeText={(value) => setContactForm((prev) => ({ ...prev, phone: formatPhoneInput(value) }))}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.field}
                placeholder="Job title"
                placeholderTextColor={COLORS.muted}
                value={contactForm.title}
                onChangeText={(value) => setContactForm((prev) => ({ ...prev, title: value }))}
              />

              <Text style={styles.sectionLabel}>Status</Text>
              <View style={styles.serviceWrap}>
                {CONTACT_STATUSES.map((status) => {
                  const active = contactForm.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setContactForm((prev) => ({ ...prev, status }))}
                      style={[styles.serviceChip, active && styles.serviceChipActive]}
                    >
                      <Text style={[styles.serviceChipText, active && styles.serviceChipTextActive]}>{status}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>Company</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineOptionList}>
                <TouchableOpacity
                  style={[styles.companyOption, styles.inlineCompanyOption, contactForm.companyId === '' && styles.companyOptionActive]}
                  onPress={() => setContactForm((prev) => ({ ...prev, companyId: '' }))}
                >
                  <Text style={[styles.companyOptionText, contactForm.companyId === '' && styles.companyOptionTextActive]}>
                    No company
                  </Text>
                </TouchableOpacity>
                {companies.map((company) => {
                  const active = contactForm.companyId === company.id;
                  return (
                    <TouchableOpacity
                      key={company.id}
                      style={[styles.companyOption, styles.inlineCompanyOption, active && styles.companyOptionActive]}
                      onPress={() => setContactForm((prev) => ({ ...prev, companyId: company.id }))}
                    >
                      <Text style={[styles.companyOptionText, active && styles.companyOptionTextActive]}>{company.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => {
                  setContactFormVisible(false);
                  setContactForm(EMPTY_CONTACT_FORM);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={submitContactForm}
                disabled={createContactMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>
                  {createContactMutation.isPending ? 'Saving...' : 'Create Contact'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={companyCreateVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Company</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.field}
                placeholder="Company name"
                placeholderTextColor={COLORS.muted}
                value={companyForm.name}
                onChangeText={(value) => setCompanyForm((prev) => ({ ...prev, name: value }))}
              />
              <TextInput
                style={styles.field}
                placeholder="Industry"
                placeholderTextColor={COLORS.muted}
                value={companyForm.industry}
                onChangeText={(value) => setCompanyForm((prev) => ({ ...prev, industry: value }))}
              />
              <TextInput
                style={styles.field}
                placeholder="Website"
                placeholderTextColor={COLORS.muted}
                value={companyForm.website}
                onFocus={() => setCompanyForm((prev) => ({ ...prev, website: prefillUrlField(prev.website) }))}
                onChangeText={(value) => setCompanyForm((prev) => ({ ...prev, website: value }))}
                autoCapitalize="none"
              />

              <Text style={styles.sectionLabel}>Company size</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineOptionList}>
                <TouchableOpacity
                  style={[styles.companyOption, styles.inlineCompanyOption, companyForm.size === '' && styles.companyOptionActive]}
                  onPress={() => setCompanyForm((prev) => ({ ...prev, size: '' }))}
                >
                  <Text style={[styles.companyOptionText, companyForm.size === '' && styles.companyOptionTextActive]}>
                    Not set
                  </Text>
                </TouchableOpacity>
                {COMPANY_SIZES.map((size) => {
                  const active = companyForm.size === size;
                  return (
                    <TouchableOpacity
                      key={size}
                      style={[styles.companyOption, styles.inlineCompanyOption, active && styles.companyOptionActive]}
                      onPress={() => setCompanyForm((prev) => ({ ...prev, size }))}
                    >
                      <Text style={[styles.companyOptionText, active && styles.companyOptionTextActive]}>{size}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.sectionLabel}>Status</Text>
              <View style={styles.serviceWrap}>
                {COMPANY_STATUSES.map((status) => {
                  const active = companyForm.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setCompanyForm((prev) => ({ ...prev, status }))}
                      style={[styles.serviceChip, active && styles.serviceChipActive]}
                    >
                      <Text style={[styles.serviceChipText, active && styles.serviceChipTextActive]}>{status}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => {
                  setCompanyCreateVisible(false);
                  setCompanyForm(EMPTY_COMPANY_FORM);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={submitCompanyForm}
                disabled={createCompanyMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>
                  {createCompanyMutation.isPending ? 'Saving...' : 'Create Company'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function serviceLabel(service: PasswordLockerService): string {
  return SERVICES.find((item) => item.value === service)?.label ?? 'Other';
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 20, paddingBottom: 12 },
  heading: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  subheading: { fontSize: 13, color: COLORS.muted },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tabBtn: { flex: 1, paddingVertical: 10, backgroundColor: COLORS.card, alignItems: 'center' },
  tabBtnActive: { backgroundColor: `${COLORS.primary}25` },
  tabText: { color: COLORS.muted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: COLORS.primary },
  crmToolsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  crmActionButton: { flex: 1, minHeight: 42 },
  lockerToolsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 6 },
  searchWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.card,
  },
  searchInput: { color: COLORS.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  secondaryButtonText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  list: { padding: 16, paddingTop: 4 },
  separator: { height: 1, backgroundColor: COLORS.border },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${COLORS.primary}22`, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  itemContent: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  itemSub: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  passwordText: { fontSize: 12, color: COLORS.text, marginTop: 4, fontFamily: 'monospace' },
  actionCol: { alignItems: 'flex-end', gap: 6 },
  contactActionCol: { alignItems: 'flex-end', gap: 8 },
  actionLink: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeActive: { backgroundColor: '#16a34a22' },
  badgeMuted: { backgroundColor: COLORS.border },
  badgeText: { fontSize: 10, fontWeight: '600', color: COLORS.muted, textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: COLORS.muted, padding: 32 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  modalTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginBottom: 10 },
  field: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  sectionLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  serviceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  serviceChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.bg,
  },
  serviceChipActive: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}20` },
  serviceChipText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  serviceChipTextActive: { color: COLORS.primary },
  helperText: { color: COLORS.muted, fontSize: 12, marginBottom: 10 },
  inlineOptionList: { paddingBottom: 8, gap: 8 },
  companyList: { maxHeight: 280, marginBottom: 12 },
  companyOption: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  inlineCompanyOption: { marginBottom: 0, minWidth: 110 },
  companyOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}20`,
  },
  companyOptionText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  companyOptionTextActive: { color: COLORS.primary },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
