import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const COLORS = {
  bg: '#0a0f1e',
  card: '#111827',
  border: '#1e2a3a',
  text: '#f8fafc',
  muted: '#94a3b8',
  primary: '#3b82f6',
  danger: '#ef4444',
};

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to connect SparQPlug mobile to your live workspace.</Text>
          </View>

          <View style={styles.card}>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.field}
              placeholder="you@company.com"
              placeholderTextColor={COLORS.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.field}
              placeholder="••••••••"
              placeholderTextColor={COLORS.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
            />

            <Pressable style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={() => { void handleSubmit(); }} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign In</Text>}
            </Pressable>

            <Text style={styles.helper}>
              Use the same Firebase account credentials as the web app or the bootstrap admin account.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  keyboardView: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24, gap: 20 },
  hero: { gap: 8 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: '700' },
  subtitle: { color: COLORS.muted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 18,
  },
  error: {
    color: COLORS.danger,
    backgroundColor: '#ef44441a',
    borderWidth: 1,
    borderColor: '#ef444433',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  label: { color: COLORS.text, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  field: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  helper: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
});