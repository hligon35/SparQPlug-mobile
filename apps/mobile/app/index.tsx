import { ActivityIndicator, View } from 'react-native';
import { Redirect, type Href } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';

const COLORS = { bg: '#0a0f1e', primary: '#3b82f6' };

export default function IndexScreen() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return <Redirect href={(user ? '/crm' : '/sign-in') as Href} />;
}