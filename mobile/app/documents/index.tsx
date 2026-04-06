import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

/* ══════════════════════════════════════════════
   기사 문서함 (Document Inbox)
   ──────────────────────────────────────────────
   - 대리점에서 전송한 문서 목록
   - 열람/서명 상태 관리
   - 문서 열기 (PDF/이미지 뷰어)
   ══════════════════════════════════════════════ */

interface DocumentDelivery {
  id: string;
  document_file_id: string | null;
  contract_id: string | null;
  send_type: string;
  title: string;
  message: string | null;
  status: string;
  sent_at: string;
  viewed_at: string | null;
  signed_at: string | null;
}

interface DocumentFileInfo {
  file_url: string;
  file_type: string;
  title: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  sent: { label: '미확인', color: '#2196F3', icon: 'mark-email-unread' },
  delivered: { label: '수신', color: '#00BCD4', icon: 'email' },
  viewed: { label: '열람', color: '#FF9800', icon: 'visibility' },
  signed: { label: '서명완료', color: '#4CAF50', icon: 'check-circle' },
  rejected: { label: '거부', color: '#F44336', icon: 'cancel' },
};

const SEND_TYPE_LABELS: Record<string, string> = {
  registration: '계약서',
  renewal: '재계약',
  amendment: '변경 서류',
  general: '일반 문서',
  education: '교육 자료',
};

export default function DocumentsScreen() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<DocumentDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    loadDriver();
  }, []);

  const loadDriver = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setDriverId(data.id);
      loadDeliveries(data.id);
    }
  };

  const loadDeliveries = async (did: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('document_deliveries')
      .select('*')
      .eq('driver_id', did)
      .order('sent_at', { ascending: false });

    if (!error && data) {
      setDeliveries(data as DocumentDelivery[]);
    }
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    if (!driverId) return;
    setRefreshing(true);
    await loadDeliveries(driverId);
    setRefreshing(false);
  }, [driverId]);

  // 문서 열기 → 상태를 viewed로 업데이트
  const handleOpen = async (delivery: DocumentDelivery) => {
    // 1. 상태 업데이트 (sent → viewed)
    if (delivery.status === 'sent' || delivery.status === 'delivered') {
      await supabase
        .from('document_deliveries')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .eq('id', delivery.id);

      setDeliveries((prev) =>
        prev.map((d) => d.id === delivery.id ? { ...d, status: 'viewed', viewed_at: new Date().toISOString() } : d)
      );
    }

    // 2. 계약서인 경우 → 계약서 상세로 이동
    if (delivery.contract_id) {
      router.push(`/contract/${delivery.contract_id}` as never);
      return;
    }

    // 3. 문서 파일인 경우 → 파일 URL로 열기
    if (delivery.status === 'signed') {
      const { data: signedFiles, error: signedListError } = await supabase.storage
        .from('documents')
        .list('signed-documents', {
          search: `${delivery.id}_`,
          limit: 20,
        });

      if (!signedListError && signedFiles && signedFiles.length > 0) {
        const latestSignedFile = [...signedFiles].sort((a, b) => {
          const aTime = a.created_at ? Date.parse(a.created_at) : 0;
          const bTime = b.created_at ? Date.parse(b.created_at) : 0;
          return bTime - aTime;
        })[0];

        const signedPath = `signed-documents/${latestSignedFile.name}`;
        const { data: signedData, error: signedUrlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(signedPath, 3600);

        if (!signedUrlError && signedData?.signedUrl) {
          await Linking.openURL(signedData.signedUrl);
          return;
        }
      }
    }

    if (delivery.document_file_id) {
      const { data } = await supabase
        .from('document_files')
        .select('file_url, file_type, title')
        .eq('id', delivery.document_file_id)
        .single();

      if (data) {
        const fileInfo = data as DocumentFileInfo;
        let openUrl = fileInfo.file_url;

        if (openUrl && !openUrl.startsWith('http')) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from('documents')
            .createSignedUrl(openUrl, 3600);

          if (signedError || !signedData?.signedUrl) {
            return;
          }

          openUrl = signedData.signedUrl;
        }

        if (openUrl) {
          await Linking.openURL(openUrl);
        }
      }
    }
  };

  const renderItem = ({ item }: { item: DocumentDelivery }) => {
    const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.sent;
    const typeLabel = SEND_TYPE_LABELS[item.send_type] ?? '문서';
    const isUnread = item.status === 'sent' || item.status === 'delivered';
    const sentDate = new Date(item.sent_at);

    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.cardUnread]}
        onPress={() => handleOpen(item)}
        activeOpacity={0.7}
      >
        {/* 상단: 타입 + 상태 */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: config.color + '20' }]}>
            <Text style={[styles.typeBadgeText, { color: config.color }]}>{typeLabel}</Text>
          </View>
          <View style={styles.statusBadge}>
            <MaterialIcons name={config.icon as never} size={14} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        {/* 제목 */}
        <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={2}>
          {item.title}
        </Text>

        {/* 메시지 (있으면) */}
        {item.message && (
          <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
        )}

        {/* 하단: 날짜 */}
        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {sentDate.toLocaleDateString('ko-KR')} {sentDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {item.viewed_at && (
            <Text style={styles.viewedText}>
              열람 {new Date(item.viewed_at).toLocaleDateString('ko-KR')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const unreadCount = deliveries.filter((d) => d.status === 'sent' || d.status === 'delivered').length;

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>문서함</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* 미확인 알림 */}
      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <MaterialIcons name="notifications-active" size={16} color="#2196F3" />
          <Text style={styles.unreadText}>미확인 문서 {unreadCount}건이 있습니다</Text>
        </View>
      )}

      {/* 문서 목록 */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : deliveries.length === 0 ? (
        <View style={styles.centerBox}>
          <MaterialIcons name="inbox" size={48} color="#ccc" />
          <Text style={styles.emptyText}>받은 문서가 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={deliveries}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginLeft: 12,
  },
  badge: {
    backgroundColor: '#F44336',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
  },
  unreadText: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardUnread: {
    borderColor: '#2196F3',
    borderWidth: 1.5,
    backgroundColor: '#FAFBFF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  title: { fontSize: 15, color: '#1a1a2e', lineHeight: 22 },
  titleUnread: { fontWeight: '700' },
  message: { fontSize: 13, color: '#666', marginTop: 6, lineHeight: 18 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  dateText: { fontSize: 11, color: '#999' },
  viewedText: { fontSize: 11, color: '#999' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: '#999' },
});
