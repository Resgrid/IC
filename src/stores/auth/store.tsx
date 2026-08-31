import * as Sentry from '@sentry/react-native';
import base64 from 'react-native-base64';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { logger } from '@/lib/logging';

import { loginRequest, refreshTokenSingleFlight, ssoExternalTokenRequest } from '../../lib/auth/api';
import type { AuthResponse, AuthState, LoginCredentials, SsoLoginCredentials } from '../../lib/auth/types';
import { type ProfileModel } from '../../lib/auth/types';
import { getAuth } from '../../lib/auth/utils';
import { setItem, zustandStorage } from '../../lib/storage';

// Last SSO exchange that failed with a 2FA challenge, retained IN MEMORY ONLY (module scope,
// never the persisted store) so the OTP prompt can retry the same IdP token with a code.
let pendingSsoMfaCredentials: SsoLoginCredentials | null = null;

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      refreshTokenExpiresOn: null,
      status: 'idle',
      error: null,
      profile: null,
      userId: null,
      isFirstTime: true,
      refreshTimeoutId: null,
      isSsoMfaPending: false,
      login: async (credentials: LoginCredentials) => {
        try {
          set({ status: 'loading' });
          const response = await loginRequest(credentials);

          if (response.successful) {
            const payload = sanitizeJson(base64.decode(response.authResponse!.id_token!.split('.')[1]));

            setItem<AuthResponse>('authResponse', response.authResponse!);
            const expiresInSeconds = response.authResponse?.expires_in ?? 3600;
            const now = new Date();
            const expiresOn = new Date(now.getTime() + expiresInSeconds * 1000).getTime().toString();

            const profileData = JSON.parse(payload) as ProfileModel;

            set({
              accessToken: response.authResponse?.access_token,
              refreshToken: response.authResponse?.refresh_token,
              refreshTokenExpiresOn: expiresOn,
              status: 'signedIn',
              error: null,
              profile: profileData,
              userId: profileData.sub,
            });

            Sentry.setUser({ id: profileData.sub, username: profileData.name });

            // Set up automatic token refresh
            //const decodedToken: { exp: number } = jwtDecode(
            //);
            //const now = new Date();
            //const expiresIn =
            //  response.authResponse?.expires_in! * 1000 - Date.now() - 60000; // Refresh 1 minute before expiry
            //const expiresOn = new Date(
            //  now.getTime() + response.authResponse?.expires_in! * 1000
            //)
            //  .getTime()
            //  .toString();

            // Schedule proactive token refresh before expiry
            // expires_in is in seconds, so convert to milliseconds and refresh 1 minute before expiry
            const refreshDelayMs = Math.max((expiresInSeconds - 60) * 1000, 60000);
            logger.info({
              message: 'Login successful, scheduling token refresh',
              context: { refreshDelayMs, expiresInSeconds },
            });
            // Clear any existing refresh timer before scheduling a new one
            const existingTimeoutId = get().refreshTimeoutId;
            if (existingTimeoutId !== null) {
              clearTimeout(existingTimeoutId);
            }
            const timeoutId = setTimeout(() => get().refreshAccessToken(), refreshDelayMs);
            set({ refreshTimeoutId: timeoutId });
          } else if (response.mfaRequired) {
            // 2FA challenge: the login screen prompts for the authenticator code and calls
            // login() again with otpCode. Credentials are never retained here.
            set({
              status: 'mfaRequired',
              error: response.invalidOtp ? 'invalid_totp' : null,
            });
          } else {
            set({
              status: 'error',
              error: response.message,
            });
          }
        } catch (error) {
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Login failed',
          });
        }
      },

      ssoLogin: async (credentials: SsoLoginCredentials) => {
        try {
          set({ status: 'loading' });
          const response = await ssoExternalTokenRequest(credentials);

          if (response.successful && response.authResponse) {
            const payload = sanitizeJson(base64.decode(response.authResponse.id_token!.split('.')[1]));

            setItem<AuthResponse>('authResponse', response.authResponse);
            const expiresInSeconds = response.authResponse.expires_in ?? 3600;
            const expiresOn = new Date(Date.now() + expiresInSeconds * 1000).getTime().toString();

            const profileData = JSON.parse(payload) as ProfileModel;

            set({
              accessToken: response.authResponse.access_token,
              refreshToken: response.authResponse.refresh_token,
              refreshTokenExpiresOn: expiresOn,
              status: 'signedIn',
              error: null,
              profile: profileData,
              userId: profileData.sub,
            });

            Sentry.setUser({ id: profileData.sub, username: profileData.name });

            const refreshDelayMs = Math.max((expiresInSeconds - 60) * 1000, 60000);
            logger.info({
              message: 'SSO login successful, scheduling token refresh',
              context: { refreshDelayMs, provider: credentials.provider },
            });

            const existingTimeoutId = get().refreshTimeoutId;
            if (existingTimeoutId !== null) {
              clearTimeout(existingTimeoutId);
            }
            const timeoutId = setTimeout(() => get().refreshAccessToken(), refreshDelayMs);
            set({ refreshTimeoutId: timeoutId, isSsoMfaPending: false });
            pendingSsoMfaCredentials = null;
          } else if (response.mfaRequired) {
            // 2FA challenge: retain the exchange in module memory (never the persisted store)
            // so retrySsoWithOtp can replay it with the authenticator code.
            //
            // The code itself is deliberately dropped. On an invalid_totp retry `credentials`
            // still carries the rejected otpCode, and keeping it would hold a known-bad secret in
            // module state until the next successful SSO login. retrySsoWithOtp supplies the new
            // code on every attempt, so nothing needs it here.
            const { otpCode: _rejectedOtpCode, ...ssoExchange } = credentials;
            pendingSsoMfaCredentials = ssoExchange;
            logger.info({
              message: 'SSO login requires two-factor verification',
              context: { provider: credentials.provider, invalidOtp: !!response.invalidOtp },
            });
            set({
              status: 'mfaRequired',
              error: response.invalidOtp ? 'invalid_totp' : null,
              isSsoMfaPending: true,
            });
          } else {
            pendingSsoMfaCredentials = null;
            set({ status: 'error', error: response.message, isSsoMfaPending: false });
          }
        } catch (error) {
          pendingSsoMfaCredentials = null;
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'SSO login failed',
            isSsoMfaPending: false,
          });
        }
      },

      retrySsoWithOtp: async (otpCode: string) => {
        if (!pendingSsoMfaCredentials) {
          set({ status: 'error', error: 'No pending SSO sign-in to verify' });
          return;
        }

        await get().ssoLogin({ ...pendingSsoMfaCredentials, otpCode });
      },

      logout: async () => {
        // Clear any pending refresh timer to prevent stacked timeouts
        const existingTimeoutId = get().refreshTimeoutId;
        if (existingTimeoutId !== null) {
          clearTimeout(existingTimeoutId);
        }
        // The retained IdP exchange is a credential; it must not outlive the session.
        pendingSsoMfaCredentials = null;
        set({
          accessToken: null,
          refreshToken: null,
          status: 'signedOut',
          error: null,
          profile: null,
          isFirstTime: true,
          refreshTimeoutId: null,
          isSsoMfaPending: false,
        });
        Sentry.setUser(null);
      },

      refreshAccessToken: async () => {
        try {
          const { refreshToken } = get();
          if (!refreshToken) {
            logger.warn({
              message: 'No refresh token available, logging out user',
            });
            get().logout();
            return;
          }

          const response = await refreshTokenSingleFlight(refreshToken);

          // Update the stored auth response for hydration
          setItem<AuthResponse>('authResponse', response);

          set({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            status: 'signedIn',
            error: null,
          });

          // Set up next token refresh - refresh 1 minute before expiry
          // expires_in is in seconds, so convert to milliseconds
          const expiresInSeconds = response.expires_in ?? 3600;
          const refreshDelayMs = Math.max((expiresInSeconds - 60) * 1000, 60000); // At least 1 minute
          logger.info({
            message: 'Token refreshed successfully, scheduling next refresh',
            context: { refreshDelayMs, expiresInSeconds },
          });
          // Clear any existing refresh timer before scheduling a new one
          const existingTimeoutId = get().refreshTimeoutId;
          if (existingTimeoutId !== null) {
            clearTimeout(existingTimeoutId);
          }
          const timeoutId = setTimeout(() => get().refreshAccessToken(), refreshDelayMs);
          set({ refreshTimeoutId: timeoutId });
        } catch (error) {
          // Check if it's a network error vs an invalid refresh token
          const isNetworkError = error instanceof Error && (error.message.includes('Network Error') || error.message.includes('timeout') || error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT'));

          if (isNetworkError) {
            // Network error - retry after a delay, don't logout
            logger.warn({
              message: 'Token refresh failed due to network error, will retry',
              context: { error: error instanceof Error ? error.message : String(error) },
            });
            // Clear any existing refresh timer before scheduling retry
            const existingTimeoutId = get().refreshTimeoutId;
            if (existingTimeoutId !== null) {
              clearTimeout(existingTimeoutId);
            }
            // Retry after 30 seconds for network errors
            const retryTimeoutId = setTimeout(() => get().refreshAccessToken(), 30000);
            set({ refreshTimeoutId: retryTimeoutId });
          } else {
            // Invalid refresh token or server rejected it - logout user
            logger.error({
              message: 'Token refresh failed with non-recoverable error, logging out user',
              context: { error: error instanceof Error ? error.message : String(error) },
            });
            get().logout();
          }
        }
      },
      hydrate: () => {
        try {
          const authResponse = getAuth();
          if (authResponse !== null && authResponse.refresh_token) {
            // We have stored auth data, try to restore the session
            try {
              const payload = sanitizeJson(base64.decode(authResponse.id_token!.split('.')[1]));
              const profileData = JSON.parse(payload) as ProfileModel;

              set({
                accessToken: authResponse.access_token,
                refreshToken: authResponse.refresh_token,
                status: 'signedIn',
                error: null,
                profile: profileData,
                userId: profileData.sub,
              });

              Sentry.setUser({ id: profileData.sub, username: profileData.name });

              logger.info({
                message: 'Auth state hydrated from storage, token refresh will be scheduled by onRehydrateStorage',
              });

              // Note: Token refresh scheduling is handled by onRehydrateStorage to avoid duplicate refreshes
            } catch (parseError) {
              // Token parsing failed, but we have a refresh token - try to refresh
              logger.warn({
                message: 'Failed to parse stored token, refresh will be attempted by onRehydrateStorage',
                context: { error: parseError instanceof Error ? parseError.message : String(parseError) },
              });

              set({
                refreshToken: authResponse.refresh_token,
                status: 'loading',
              });

              // Note: Token refresh is handled by onRehydrateStorage to avoid duplicate refreshes
            }
          } else {
            logger.info({
              message: 'No stored auth data found, user needs to login',
            });
            get().logout();
          }
        } catch (e) {
          logger.error({
            message: 'Failed to hydrate auth state',
            context: { error: e instanceof Error ? e.message : String(e) },
          });
          // Don't logout here - let the user try to use the app
          // and handle auth errors via the axios interceptor
        }
      },
      isAuthenticated: (): boolean => {
        return get().status === 'signedIn' && get().accessToken !== null;
      },
      setIsOnboarding: () => {
        logger.info({
          message: 'Setting isOnboarding to true',
        });

        set({
          status: 'onboarding',
        });
      },
      //getRights: async () => {
      //  try {
      //    const response = await getCurrentUsersRights();

      //    set({
      //      rights: response.Data,
      //    });
      //  } catch (error) {
      //    // If refresh fails, log out the user
      //  }
      //},
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => zustandStorage),
      // The pending SSO exchange lives in module memory and dies with the process, so a rehydrated
      // `true` here would open the OTP prompt with nothing to retry. Force it back to false.
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<AuthState>), isSsoMfaPending: false }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            logger.error({
              message: 'Failed to rehydrate auth storage',
              context: { error: error instanceof Error ? error.message : String(error) },
            });
            return;
          }

          // Defer execution to ensure useAuthStore is fully initialized
          setTimeout(() => {
            if (state && state.refreshToken && state.status === 'signedIn') {
              // We have a stored refresh token and were previously signed in
              // Schedule an immediate token refresh to ensure we have a valid access token
              logger.info({
                message: 'Auth state rehydrated from storage, scheduling token refresh',
                context: { hasAccessToken: !!state.accessToken, hasRefreshToken: !!state.refreshToken },
              });

              // Clear any existing refresh timer before scheduling a new one
              const existingTimeoutId = useAuthStore.getState().refreshTimeoutId;
              if (existingTimeoutId !== null) {
                clearTimeout(existingTimeoutId);
              }
              // Use a small delay to allow the app to fully initialize
              const timeoutId = setTimeout(() => {
                useAuthStore.getState().refreshAccessToken();
              }, 2000);
              useAuthStore.setState({ refreshTimeoutId: timeoutId });
            } else if (state && state.refreshToken && state.status !== 'signedIn') {
              // We have a refresh token but status is not signedIn (maybe was idle/error)
              // Try to refresh and restore the session
              logger.info({
                message: 'Found refresh token in storage with non-signedIn status, attempting to restore session',
                context: { status: state.status },
              });

              // Clear any existing refresh timer before scheduling a new one
              const existingTimeoutId = useAuthStore.getState().refreshTimeoutId;
              if (existingTimeoutId !== null) {
                clearTimeout(existingTimeoutId);
              }
              // Set status to loading while we try to refresh
              useAuthStore.setState({ status: 'loading' });

              const timeoutId = setTimeout(() => {
                useAuthStore.getState().refreshAccessToken();
              }, 2000);
              useAuthStore.setState({ refreshTimeoutId: timeoutId });
            }
          }, 0);
        };
      },
    }
  )
);

const sanitizeJson = (json: string) => {
  return json.replace(/[\u0000]+/g, '');
};

export default useAuthStore;
