import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import type { ApiResponse, PaginatedResponse, Document } from '@sparqplug/types';

const COLORS = { bg: '#0a0f1e', card: '#111827', border: '#1e2a3a', text: '#f8fafc', muted: '#94a3b8', primary: '#3b82f6' };

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function getItems<T>(response?: ApiResponse<PaginatedResponse<T>>): T[] {
  const payload = response?.data as unknown as { items?: T[]; data?: T[] } | undefined;
  return payload?.items ?? payload?.data ?? [];
}

export default function DocumentsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['documents-mobile'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Document>>>('/documents', { folderId: 'root', limit: 30 }),
  });

  const docs = getItems(data);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Documents</Text>
        <Text style={styles.subheading}>{data?.data?.total ?? 0} files</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: COLORS.border }} />}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={styles.fileIcon}>
                <Text style={styles.fileIconText}>📄</Text>
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemSub}>{formatBytes(item.size)} · {item.mimeType.split('/')[1]}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No documents found</Text>}
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
  fileIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  fileIconText: { fontSize: 18 },
  itemContent: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  itemSub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.muted, padding: 32 },
});
