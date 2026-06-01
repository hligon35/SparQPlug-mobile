import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth-store';
import { signOut } from 'firebase/auth';
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

  async function handleSignOut() {
    await signOut(auth);
    clearAuth();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>More</Text>
      </View>

      {/* User card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0] ?? '?'}</Text>
        </View>
        <View>
          <Text style={styles.userName}>{user?.name ?? 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 20, paddingBottom: 12 },
  heading: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginBottom: 24, padding: 16, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: `${COLORS.primary}22`, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: COLORS.primary, fontWeight: '700', fontSize: 18 },
  userName: { color: COLORS.text, fontWeight: '600', fontSize: 16 },
  userEmail: { color: COLORS.muted, fontSize: 13, marginTop: 2 },
  section: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  menuEmoji: { fontSize: 18, width: 28 },
  menuLabel: { flex: 1, fontSize: 15, color: COLORS.text },
  chevron: { fontSize: 20, color: COLORS.muted },
  signOutBtn: { marginHorizontal: 16, marginTop: 24, paddingVertical: 14, backgroundColor: `${COLORS.destructive}15`, borderRadius: 12, borderWidth: 1, borderColor: `${COLORS.destructive}30`, alignItems: 'center' },
  signOutText: { color: COLORS.destructive, fontWeight: '600', fontSize: 15 },
});
