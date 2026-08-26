import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => {
        sessionStorage.setItem('token', token);
        localStorage.setItem('token', token);
        set({ token });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refresh_token');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        set({ token: null, user: null });
      },
    }),
    {
      name: 'talentai-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ token: s.token, user: s.user }),
    }
  )
);
