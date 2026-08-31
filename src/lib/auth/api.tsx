import { Env } from '@env';
import axios from 'axios';
import queryString from 'query-string';

import { logger } from '@/lib/logging';

import { getBaseApiUrl } from '../storage/app';
import type { AuthResponse, LoginCredentials, LoginResponse, SsoLoginCredentials } from './types';

const authApi = axios.create({
  baseURL: getBaseApiUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// Dynamically update baseURL on every request to support
// custom server URL changes (e.g. self-hosted environments)
authApi.interceptors.request.use((config) => {
  config.baseURL = getBaseApiUrl();
  return config;
});

export const loginRequest = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    const data = queryString.stringify({
      grant_type: 'password',
      username: credentials.username,
      password: credentials.password,
      // Accounts with Resgrid 2FA enabled must supply the current authenticator code.
      ...(credentials.otpCode ? { totp_code: credentials.otpCode.trim() } : {}),
      scope: Env.IS_MOBILE_APP === 'true' ? 'openid profile offline_access mobile' : 'openid profile offline_access',
    });

    const response = await authApi.post<AuthResponse>('/connect/token', data);

    if (response.status === 200) {
      logger.info({
        message: 'Login successful',
        context: { username: credentials.username },
      });

      return {
        successful: true,
        message: 'Login successful',
        authResponse: response.data,
      };
    } else {
      logger.error({
        message: 'Login failed',
        context: { response, username: credentials.username },
      });

      return {
        successful: false,
        message: 'Login failed',
        authResponse: null,
      };
    }
  } catch (error) {
    // The OAuth error body distinguishes the 2FA challenge from a bad password. Neither the
    // password nor any code is ever logged.
    const oauthError = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
    if (oauthError === 'mfa_required' || oauthError === 'invalid_totp') {
      logger.info({
        message: 'Login requires two-factor code',
        context: { invalidOtp: oauthError === 'invalid_totp' },
      });

      return {
        successful: false,
        message: 'Two-factor authentication required',
        authResponse: null,
        mfaRequired: true,
        invalidOtp: oauthError === 'invalid_totp',
      };
    }

    logger.error({
      message: 'Login failed',
      context: { error, username: credentials.username },
    });
    throw error;
  }
};

export const refreshTokenRequest = async (refreshToken: string): Promise<AuthResponse> => {
  try {
    const data = queryString.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: '',
    });

    const response = await authApi.post<AuthResponse>('/connect/token', data);

    logger.info({
      message: 'Token refresh successful',
    });

    return response.data;
  } catch (error) {
    logger.error({
      message: 'Token refresh failed',
      context: { error },
    });
    throw error;
  }
};

/**
 * Single-flight wrapper around refreshTokenRequest. Concurrent callers
 * (axios 401 interceptor and the proactive refresh timer in the auth store)
 * share one in-flight request so the rotating refresh token is only
 * consumed once; every caller receives the same new token pair.
 */
let inFlightRefresh: Promise<AuthResponse> | null = null;

export const refreshTokenSingleFlight = (refreshToken: string): Promise<AuthResponse> => {
  if (!inFlightRefresh) {
    inFlightRefresh = refreshTokenRequest(refreshToken).finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
};

/**
 * Exchange an external IdP token (OIDC id_token or SAML SAMLResponse) for
 * Resgrid access/refresh tokens via POST /api/v4/connect/external-token.
 */
export const ssoExternalTokenRequest = async (credentials: SsoLoginCredentials): Promise<LoginResponse> => {
  try {
    const data = queryString.stringify({
      provider: credentials.provider,
      external_token: credentials.externalToken,
      username: credentials.username,
      // Accounts with Resgrid 2FA enabled must supply the current authenticator code even via SSO.
      ...(credentials.otpCode ? { totp_code: credentials.otpCode.trim() } : {}),
      scope: Env.IS_MOBILE_APP === 'true' ? 'openid email profile offline_access mobile' : 'openid email profile offline_access',
    });

    const response = await authApi.post<AuthResponse>('/connect/external-token', data);

    if (response.status === 200) {
      logger.info({
        message: 'SSO external token exchange successful',
        context: { provider: credentials.provider, username: credentials.username },
      });

      return {
        successful: true,
        message: 'SSO login successful',
        authResponse: response.data,
      };
    }

    logger.error({
      message: 'SSO external token exchange failed',
      context: { status: response.status, username: credentials.username },
    });

    return { successful: false, message: 'SSO login failed', authResponse: null };
  } catch (error) {
    // The error body distinguishes the 2FA challenge from a real failure. Neither the IdP
    // token nor any code is ever logged.
    const oauthError = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
    if (oauthError === 'mfa_required' || oauthError === 'invalid_totp') {
      logger.info({
        message: 'SSO login requires two-factor code',
        context: { provider: credentials.provider, invalidOtp: oauthError === 'invalid_totp' },
      });

      return {
        successful: false,
        message: 'Two-factor authentication required',
        authResponse: null,
        mfaRequired: true,
        invalidOtp: oauthError === 'invalid_totp',
      };
    }

    logger.error({
      message: 'SSO external token exchange error',
      context: { error, username: credentials.username },
    });
    throw error;
  }
};
