import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth-store';
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const COLORS = { bg: '#0a0f1e', card: '#111827', border: '#1e2a3a', text: '#f8fafc', muted: '#94a3b8', primary: '#3b82f6', destructive: '#ef4444' };

const ITEMS = [
  { label: 'Analytics', emoji: '📊', href: null },
  { label: 'Settings', emoji: '⚙️', href: null },
  { label: 'Privacy Policy', emoji: '🔒', href: 'https://sparqplug.com/privacy' },
  { label: 'Terms of Service', emoji: '📜', href: 'https://sparqplug.com/terms' },
];

export default function MoreScreen() {
  const { user, signOut: clearAuth } = useAuthStore();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSignOut() {
    await signOut(auth);
    clearAuth();
  }

  async function handleChangePassword() {
    if (!auth.currentUser?.email) {
      Alert.alert('Unavailable', 'You must be signed in to change your password.');
      return;
    }

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      Alert.alert('Required', 'Fill in all password fields.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      Alert.alert('Too short', 'New password must be at least 8 characters.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordForm.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      Alert.alert('Updated', 'Password changed successfully.');
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Unable to change password.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.heading}>More</Text>
        </View>

        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0] ?? '?'}</Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName}>{user?.name ?? 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <Text style={styles.sectionHint}>Re-enter your current password before setting a new one.</Text>
          <TextInput
            style={styles.field}
            placeholder="Current password"
            placeholderTextColor={COLORS.muted}
            value={passwordForm.currentPassword}
            onChangeText={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            style={styles.field}
            placeholder="New password"
            placeholderTextColor={COLORS.muted}
            value={passwordForm.newPassword}
            onChangeText={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            style={styles.field}
            placeholder="Confirm new password"
            placeholderTextColor={COLORS.muted}
            value={passwordForm.confirmPassword}
            onChangeText={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
            secureTextEntry
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.primaryAction} onPress={() => { void handleChangePassword(); }} disabled={savingPassword}>
            <Text style={styles.primaryActionText}>{savingPassword ? 'Updating…' : 'Update Password'}</Text>
          </TouchableOpacity>
        </View>

        {/* Menu items */}
        <View style={styles.section}>
          {ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuItem}
              onPress={() => item.href ? Linking.openURL(item.href) : undefined}
            >
              <Text style={styles.menuEmoji}>{item.emoji}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 32 },
  header: { padding: 20, paddingBottom: 12 },
  heading: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginBottom: 24, padding: 16, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: `${COLORS.primary}22`, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: COLORS.primary, fontWeight: '700', fontSize: 18 },
  userMeta: { flex: 1, minWidth: 0 },
  userName: { color: COLORS.text, fontWeight: '600', fontSize: 16 },
  userEmail: { color: COLORS.muted, fontSize: 13, marginTop: 2 },
  sectionCard: { marginHorizontal: 16, marginBottom: 20, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  sectionHint: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 12 },
  field: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, borderRadius: 10, color: COLORS.text, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10, fontSize: 14 },
  primaryAction: { marginTop: 4, backgroundColor: COLORS.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  section: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  menuEmoji: { fontSize: 18, width: 28 },
  menuLabel: { flex: 1, fontSize: 15, color: COLORS.text },
  chevron: { fontSize: 20, color: COLORS.muted },
  signOutBtn: { marginHorizontal: 16, marginTop: 24, paddingVertical: 14, backgroundColor: `${COLORS.destructive}15`, borderRadius: 12, borderWidth: 1, borderColor: `${COLORS.destructive}30`, alignItems: 'center' },
  signOutText: { color: COLORS.destructive, fontWeight: '600', fontSize: 15 },
});
