import { ActivityIndicator, View } from 'react-native';
import { Redirect, Slot } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';

const COLORS = { bg: '#0a0f1e', primary: '#3b82f6' };

export default function AuthLayout() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/crm" />;
  }

  return <Slot />;
}