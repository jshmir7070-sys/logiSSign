import { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

interface EditableField {
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  editable: boolean;   // 기사 본인 수정 가능 여부
  keyboard?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
  note?: string;
}

const FIELDS: EditableField[] = [
  { key: 'name', label: '이름', icon: 'person', editable: false, note: '대리점에 수정 요청' },
  { key: 'phone', label: '전화번호', icon: 'phone', editable: true, keyboard: 'phone-pad' },
  { key: 'email', label: '이메일', icon: 'email', editable: true, keyboard: 'email-address' },
  { key: 'birth_date', label: '생년월일', icon: 'cake', editable: true },
  { key: 'address', label: '주소', icon: 'home', editable: true },
  { key: 'vehicle_number', label: '차량번호', icon: 'directions-car', editable: true },
  { key: 'vehicle_type', label: '차종', icon: 'local-shipping', editable: true },
  { key: 'vehicle_year', label: '연식', icon: 'event', editable: true },
  { key: 'vehicle_vin', label: '차대번호', icon: 'confirmation-number', editable: true },
  { key: 'bank_name', label: '은행명', icon: 'account-balance', editable: true },
  { key: 'bank_account', label: '계좌번호', icon: 'credit-card', editable: true, keyboard: 'numeric' },
  { key: 'bank_holder', label: '예금주', icon: 'person-outline', editable: true },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { driver } = useAuthStore();
  const [form, setForm] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!driver?.id) return;
    (async () => {
      const { data } = await supabase.from('drivers').select('*').eq('id', driver.id).single();
      if (data) {
        const d = data as Record<string, unknown>;
        const values: Record<string, string> = {};
        FIELDS.forEach(f => { values[f.key] = d[f.key] != null ? String(d[f.key]) : ''; });
        setForm(values);
        setOriginal(values);
      }
    })();
  }, [driver?.id]);

  const hasChanges = FIELDS.some(f => f.editable && form[f.key] !== original[f.key]);

  const toggleEdit = (key: string) => {
    setEditing(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setForm(p => ({ ...p, [key]: original[key] }));
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);

    const changed: Record<string, string> = {};
    FIELDS.forEach(f => {
      if (f.editable && form[f.key] !== original[f.key]) {
        changed[f.key] = form[f.key] || '';
      }
    });

    try {
      const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://logissign.com';
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`${APP_URL}/api/drivers/update-self`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(changed),
      });
      const result = await res.json();

      if (!res.ok) {
        Alert.alert('수정 실패', result.error || '오류가 발생했습니다');
      } else {
        setOriginal({ ...form });
        setEditing(new Set());
        Alert.alert('수정 완료', '개인정보가 수정되었습니다.');
      }
    } catch {
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="내 정보 수정" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        {FIELDS.map(f => {
          const isEditing = editing.has(f.key);
          return (
            <View key={f.key} style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLeft}>
                  <MaterialIcons name={f.icon} size={18} color={colors.onSurfaceVariant} />
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                </View>
                {f.editable ? (
                  <TouchableOpacity onPress={() => toggleEdit(f.key)} activeOpacity={0.7}>
                    <Text style={[styles.editBtn, isEditing && styles.editBtnCancel]}>
                      {isEditing ? '취소' : '수정'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.readonlyBadge}>수정불가</Text>
                )}
              </View>

              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={form[f.key]}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                  keyboardType={f.keyboard || 'default'}
                  autoFocus
                  placeholder={f.label + ' 입력'}
                  placeholderTextColor={colors.outline}
                />
              ) : (
                <Text style={[styles.fieldValue, !form[f.key] && styles.fieldEmpty]}>
                  {form[f.key] || (f.note || '미등록')}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* 하단 저장 */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0) + spacing.md }]}>
        <Button
          title={saving ? '저장 중...' : '변경사항 저장'}
          onPress={handleSave}
          disabled={!hasChanges || saving}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  fieldCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  fieldLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fieldLabel: { ...typography.labelMedium, color: colors.onSurfaceVariant },
  editBtn: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.primary + '12',
    borderRadius: borderRadius.sm,
  },
  editBtnCancel: {
    color: colors.error,
    backgroundColor: colors.error + '12',
  },
  readonlyBadge: {
    ...typography.labelSmall,
    color: colors.outline,
    fontSize: 10,
  },
  fieldValue: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    paddingVertical: spacing.xs,
  },
  fieldEmpty: { color: colors.outline, fontStyle: 'italic' },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    ...typography.bodyMedium,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLow,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '20',
  },
});
