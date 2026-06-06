import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import type { ApiResponse, PaginatedResponse, StripeInvoice, InvoiceStatus } from '@sparqplug/types';

const COLORS = { bg: '#0a0f1e', card: '#111827', border: '#1e2a3a', text: '#f8fafc', muted: '#94a3b8', primary: '#3b82f6' };

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: COLORS.muted,
  open: '#3b82f6',
  paid: '#22c55e',
  void: COLORS.muted,
  uncollectible: '#ef4444',
};

function getItems<T>(response?: ApiResponse<PaginatedResponse<T>>): T[] {
  if (!response?.data) return [];
  return response.data.items ?? response.data.data ?? [];
}

export default function BillingScreen() {
  const { data, isLoading } = useQuery<ApiResponse<PaginatedResponse<StripeInvoice>>>({
    queryKey: ['billing-invoices-mobile'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<StripeInvoice>>>('/billing/invoices', { limit: 20 }),
  });

  const invoices = getItems<StripeInvoice>(data);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Billing</Text>
        <Text style={styles.subheading}>{data?.data?.total ?? 0} invoices</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList<StripeInvoice>
          data={invoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: COLORS.border }} />}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={styles.itemContent}>
                <Text style={styles.itemId} numberOfLines={1}>{item.stripeInvoiceId}</Text>
                <Text style={styles.itemSub}>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No due date'}</Text>
              </View>
              <View>
                <Text style={styles.amount}>${(item.amountDue / 100).toFixed(2)}</Text>
                <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No invoices found</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 20, paddingBottom: 12 },
  heading: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  subheading: { fontSize: 13, color: COLORS.muted },
  list: { padding: 16, paddingTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.card, borderRadius: 8, marginBottom: 1, gap: 12 },
  itemContent: { flex: 1, minWidth: 0 },
  itemId: { fontSize: 12, fontFamily: 'monospace', color: COLORS.text },
  itemSub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'right' },
  status: { fontSize: 10, fontWeight: '600', textAlign: 'right', marginTop: 2, textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: COLORS.muted, padding: 32 },
});
