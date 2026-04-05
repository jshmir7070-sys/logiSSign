import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Row } from '../types/database';

type Driver = Row<'drivers'>;

interface AuthState {
  session: Session | null;
  driver: (Driver & { agency_name: string | null; agency_logo_url: string | null }) | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setDriver: (driver: AuthState['driver']) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  fetchDriver: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  driver: null,
  isLoading: true,

  setSession: (session) => {
    set({ session, isLoading: false });
  },

  setDriver: (driver) => {
    set({ driver });
  },

  /**
   * 이메일 + 비밀번호 로그인
   * Supabase Auth → drivers 테이블 조회
   */
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // 사용자 친화적 에러 메시지
        if (error.message.includes('Invalid login')) {
          return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
        }
        return { error: error.message };
      }

      set({ session: data.session });

      if (data.session?.user.id) {
        const store = useAuthStore.getState();
        store.fetchDriver(data.session.user.id);
      }

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.';
      return { error: message };
    }
  },

  signOut: async () => {
    // 푸시 토큰 해제
    const currentDriver = useAuthStore.getState().driver;
    if (currentDriver?.id) {
      const { unregisterPushToken } = await import('../services/push.service');
      await unregisterPushToken(currentDriver.id);
    }
    await supabase.auth.signOut();
    set({ session: null, driver: null });
  },

  /**
   * user_id로 drivers 테이블에서 기사 정보 + 소속 대리점명 조회
   */
  fetchDriver: async (userId) => {
    try {
      const { data: driverData, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !driverData) {
        set({ isLoading: false });
        return;
      }

      let agencyName: string | null = null;
      let agencyLogoUrl: string | null = null;
      if (driverData.agency_id) {
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('name')
          .eq('id', driverData.agency_id)
          .single();
        agencyName = agencyData?.name ?? null;
        agencyLogoUrl = null;
      }

      set({
        driver: {
          ...driverData,
          agency_name: agencyName,
          agency_logo_url: agencyLogoUrl,
        },
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
