import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import type { ApiResponse, RevenueMetrics } from '@sparqplug/types';

const COLORS = { bg: '#0a0f1e', card: '#111827', border: '#1e2a3a', text: '#f8fafc', muted: '#94a3b8', primary: '#3b82f6' };

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['revenue-metrics'],
    queryFn: () => api.get<ApiResponse<RevenueMetrics>>('/billing/revenue-metrics'),
  });

  const metrics = data?.data;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Dashboard</Text>
        <Text style={styles.subheading}>Your business at a glance</Text>

        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : (
          <View style={styles.grid}>
            <MetricCard label="MRR" value={metrics ? `$${(metrics.mrr / 100).toLocaleString()}` : '—'} />
            <MetricCard label="ARR" value={metrics ? `$${(metrics.arr / 100).toLocaleString()}` : '—'} />
            <MetricCard label="Active Subs" value={metrics ? String(metrics.activeSubscriptions) : '—'} />
            <MetricCard label="ARPU" value={metrics ? `$${(metrics.averageRevenuePerUser / 100).toLocaleString()}` : '—'} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  subheading: { fontSize: 14, color: COLORS.muted, marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  cardLabel: { fontSize: 12, color: COLORS.muted, marginBottom: 8 },
  cardValue: { fontSize: 22, fontWeight: '700', color: COLORS.text },
});
