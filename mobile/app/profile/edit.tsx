import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { borderRadius, colors, shadows, spacing, typography } from '../../constants/theme';

type ProfileSection = 'all' | 'contact' | 'vehicle';

interface EditableField {
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  editable: boolean;
  keyboard?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
  note?: string;
  section: ProfileSection;
}

const FIELDS: EditableField[] = [
  { key: 'name', label: '이름', icon: 'person', editable: false, note: '대리점에 수정 요청', section: 'all' },
  { key: 'phone', label: '전화번호', icon: 'phone', editable: true, keyboard: 'phone-pad', section: 'contact' },
  { key: 'email', label: '이메일', icon: 'email', editable: true, keyboard: 'email-address', section: 'contact' },
  { key: 'birth_date', label: '생년월일', icon: 'cake', editable: false, note: '대리점에 수정 요청', section: 'all' },
  { key: 'address', label: '주소', icon: 'home', editable: true, section: 'contact' },
  { key: 'vehicle_number', label: '차량번호', icon: 'directions-car', editable: true, section: 'vehicle' },
  { key: 'vehicle_type', label: '차종', icon: 'local-shipping', editable: true, section: 'vehicle' },
  { key: 'vehicle_year', label: '연식', icon: 'event', editable: true, section: 'vehicle' },
  { key: 'vehicle_vin', label: '차대번호', icon: 'confirmation-number', editable: true, section: 'vehicle' },
  { key: 'bank_name', label: '은행명', icon: 'account-balance', editable: true, section: 'all' },
  { key: 'bank_account', label: '계좌번호', icon: 'credit-card', editable: true, keyboard: 'numeric', section: 'all' },
  { key: 'bank_holder', label: '예금주', icon: 'person-outline', editable: true, section: 'all' },
];

function isProfileSection(value: unknown): value is ProfileSection {
  return value === 'all' || value === 'contact' || value === 'vehicle';
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ section?: string }>();
  const section = isProfileSection(params.section) ? params.section : 'all';
  const scrollViewRef = useRef<ScrollView | null>(null);
  const fieldOffsets = useRef<Record<string, number>>({});
  const { driver, setDriver } = useAuthStore();
  const [form, setForm] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Set<string>>(new Set());

  const visibleFields = useMemo(() => {
    if (section === 'all') return FIELDS;
    return FIELDS.filter((field) => field.section === section || field.section === 'all');
  }, [section]);

  useEffect(() => {
    if (!driver?.id) return;

    (async () => {
      const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://logissign.com';
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`${appUrl}/api/drivers/me`, {
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
      });

      const result = await response.json().catch(() => ({}));
      if (response.ok && result.data) {
        const nextValues: Record<string, string> = {};
        FIELDS.forEach((field) => {
          const rawValue = result.data[field.key];
          nextValues[field.key] = rawValue != null ? String(rawValue) : '';
        });
        setForm(nextValues);
        setOriginal(nextValues);

        if (section !== 'all') {
          const keysToOpen = FIELDS.filter((field) => field.section === section && field.editable).map((field) => field.key);
          setEditing(new Set(keysToOpen));
        }
      }
    })();
  }, [driver?.id, section]);

  useEffect(() => {
    if (section === 'all') return;
    const firstField = FIELDS.find((field) => field.section === section);
    if (!firstField) return;

    const timeout = setTimeout(() => {
      const targetY = fieldOffsets.current[firstField.key];
      if (targetY != null) {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 24), animated: true });
      }
    }, 80);

    return () => clearTimeout(timeout);
  }, [form, section]);

  const hasChanges = visibleFields.some((field) => field.editable && form[field.key] !== original[field.key]);

  const toggleEdit = (key: string) => {
    setEditing((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setForm((current) => ({ ...current, [key]: original[key] }));
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
    visibleFields.forEach((field) => {
      if (field.editable && form[field.key] !== original[field.key]) {
        changed[field.key] = form[field.key] || '';
      }
    });

    try {
      const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://logissign.com';
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`${appUrl}/api/drivers/update-self`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(changed),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        Alert.alert('수정 실패', result.error || '오류가 발생했습니다.');
        return;
      }

      setOriginal({ ...form });
      setEditing(new Set());
      if (driver) {
        setDriver({
          ...driver,
          ...changed,
        });
      }
      Alert.alert('수정 완료', '개인정보가 수정되었습니다.');
    } catch {
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const title = section === 'contact' ? '연락처 수정' : section === 'vehicle' ? '차량정보 수정' : '개인정보 수정';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title={title} showBack />

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.content}>
        {visibleFields.map((field) => {
          const isEditing = editing.has(field.key);

          return (
            <View
              key={field.key}
              style={styles.fieldCard}
              onLayout={(event) => {
                fieldOffsets.current[field.key] = event.nativeEvent.layout.y;
              }}
            >
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLeft}>
                  <MaterialIcons name={field.icon} size={18} color={colors.onSurfaceVariant} />
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                </View>
                {field.editable ? (
                  <TouchableOpacity onPress={() => toggleEdit(field.key)} activeOpacity={0.7}>
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
                  value={form[field.key]}
                  onChangeText={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
                  keyboardType={field.keyboard || 'default'}
                  placeholder={`${field.label} 입력`}
                  placeholderTextColor={colors.outline}
                />
              ) : (
                <Text style={[styles.fieldValue, !form[field.key] && styles.fieldEmpty]}>
                  {form[field.key] || field.note || '미등록'}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0) + spacing.md },
        ]}
      >
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
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
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
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
  },
  editBtn: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: `${colors.primary}12`,
    borderRadius: borderRadius.sm,
  },
  editBtnCancel: {
    color: colors.error,
    backgroundColor: `${colors.error}12`,
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
  fieldEmpty: {
    color: colors.outline,
    fontStyle: 'italic',
  },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: `${colors.primary}40`,
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
    borderTopColor: `${colors.outlineVariant}20`,
  },
});
