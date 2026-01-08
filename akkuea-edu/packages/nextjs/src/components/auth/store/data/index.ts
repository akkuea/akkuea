import { create } from 'zustand';
import { devtools, DevtoolsOptions, persist } from 'zustand/middleware';
import { AuthenticationStore } from './@types/authentication.entity';
import { useGlobalAuthenticationSlice } from './slices/authentication.slide';

type AuthState = AuthenticationStore;

const devtoolsOptions: DevtoolsOptions = {
  name: 'Global State',
  serialize: {
    options: {
      undefined: true,
      function: false,
      symbol: false,
      error: true,
      date: true,
      regexp: true,
      bigint: true,
      map: true,
      set: true,
      depth: 10,
      maxSize: 50000,
    },
  },
  enabled: process.env.NODE_ENV === 'development',
  anonymousActionType: 'Unknown',
  stateSanitizer: (state: AuthState) => {
    return {
      ...state,
      notificationsApi: '<NOTIFICATIONS_API>',
      contextHolder: '<CONTEXT_HOLDER>',
    };
  },
};

export const useGlobalAuthenticationStore = create<AuthState>()(
  devtools(
    persist(
      (...a) => ({
        ...useGlobalAuthenticationSlice(...a),
      }),
      {
        name: 'address-wallet',
      }
    ),
    devtoolsOptions
  )
);
