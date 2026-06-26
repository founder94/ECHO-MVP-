import { useState, useCallback, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { recordAuthEvent, linkVisitorToUser, getVisitorId } from '@/hooks/useAnalytics';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  age_group: string | null;
  onboarding_answers: unknown;
  role: string | null;
  payment_status: string | null;
}

interface AuthState {
  currentUser: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasPaid: boolean;
}

type AuthProviderType = 'google' | 'apple' | 'kakao';

function buildDefaultProfile(user: User, name: string): Profile {
  return {
    id: user.id,
    email: user.email || '',
    name,
    age_group: null,
    onboarding_answers: [],
    role: null,
    payment_status: null,
  };
}

async function loadUserProfile(user: User): Promise<{ profile: Profile | null; hasPaid: boolean }> {
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    '';

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email || '',
        name,
        age_group: null,
        onboarding_answers: [],
      });

      if (insertError) {
        return { profile: null, hasPaid: false };
      }
      return { profile: buildDefaultProfile(user, name), hasPaid: false };
    }

    return {
      profile: profile as Profile,
      hasPaid: profile.payment_status === 'paid',
    };
  } catch {
    return { profile: null, hasPaid: false };
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    currentUser: null,
    profile: null,
    loading: true,
    isAuthenticated: false,
    hasPaid: false,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;

      const user = session?.user ?? null;
      if (user) {
        void loadUserProfile(user).then(({ profile, hasPaid }) => {
          if (!mountedRef.current) return;
          setState({
            currentUser: user,
            profile,
            loading: false,
            isAuthenticated: true,
            hasPaid,
          });
        });
      } else {
        setState({
          currentUser: null,
          profile: null,
          loading: false,
          isAuthenticated: false,
          hasPaid: false,
        });
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      const user = session?.user ?? null;
      if (user) {
        void loadUserProfile(user).then(({ profile, hasPaid }) => {
          if (!mountedRef.current) return;
          setState({
            currentUser: user,
            profile,
            loading: false,
            isAuthenticated: true,
            hasPaid,
          });
        });
      } else {
        setState({ currentUser: null, profile: null, loading: false, isAuthenticated: false, hasPaid: false });
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string, ageGroup?: string, answers?: number[]) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          return { success: false, error: '이미 등록된 이메일입니다' };
        }
        return { success: false, error: error.message };
      }

      const user = data.user;
      if (user) {
        const visitorId = getVisitorId();
        if (visitorId) linkVisitorToUser(visitorId, user.id);
        recordAuthEvent('이메일 회원가입', 'auth_signup', user.id);

        const { error: profileError } = await supabase.from('profiles').insert({
          id: user.id,
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          age_group: ageGroup || null,
          onboarding_answers: answers || [],
        });

        if (profileError) {
          console.error('프로필 생성 실패:', profileError.message);
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '회원가입 중 오류가 발생했습니다' };
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          return { success: false, error: '이메일 인증이 완료되지 않았습니다. 이메일을 확인해 주세요.' };
        }
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다.' };
        }
        return { success: false, error: '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
      }

      const user = data.user;
      if (user) {
        const visitorId = getVisitorId();
        if (visitorId) linkVisitorToUser(visitorId, user.id);
        recordAuthEvent('이메일 로그인', 'auth_login', user.id);

        void loadUserProfile(user).then(({ profile, hasPaid }) => {
          if (mountedRef.current) {
            setState((prev) => ({
              ...prev,
              currentUser: user,
              profile,
              isAuthenticated: true,
              hasPaid,
            }));
          }
        });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '로그인 중 오류가 발생했습니다' };
    }
  }, []);

  const socialLogin = useCallback(async (provider: AuthProviderType) => {
    const basePath = (window as any).__BASE_PATH__ || '';
    const pathPrefix = basePath ? `/${basePath.split('/').filter(Boolean).join('/')}` : '';
    const redirectTo = `${window.location.origin}${pathPrefix}/`;

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, url: data.url };
    } catch (err: any) {
      return { success: false, error: err.message || '소셜 로그인 중 오류가 발생했습니다' };
    }
  }, []);

  const logout = useCallback(async (userId?: string) => {
    try {
      if (userId) recordAuthEvent('로그아웃', 'auth_logout', userId);
      await supabase.auth.signOut();
    } catch {
      // 세션 종료는 UI에서 처리
    }
  }, []);

  return {
    currentUser: state.currentUser,
    profile: state.profile,
    loading: state.loading,
    isAuthenticated: state.isAuthenticated,
    hasPaid: state.hasPaid,
    signup,
    login,
    socialLogin,
    logout,
  };
}