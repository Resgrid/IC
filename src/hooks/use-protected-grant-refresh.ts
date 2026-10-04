import React from 'react';

import { dataProtectionStore } from '@/stores/data-protection/store';

/** A re-fetch at grant expiry waits this much past it, so the request can't still go out with the grant attached. */
export const GRANT_EXPIRY_MARGIN_MS = 1000;

/**
 * Re-fetches protected data whenever what the server will reveal changes: when the Protected Data Grant changes (a step-up
 * replaces REDACTED values; a conceal or sign-out puts them back) and when it expires. A lapsed grant keeps its token in the
 * store (expiry is checked at the moment of use, see getGrantHeaders), so watching the token alone never sees an expiry and
 * revealed values would stay on screen.
 *
 * The panel's own first fetch covers mount unless a held grant has already expired: its cache may still contain
 * revealed values, so force a refresh then. Pass a stable `refresh` (useCallback).
 */
export const useProtectedGrantRefresh = (refresh: () => void): void => {
  const grantToken = dataProtectionStore((state) => state.grantToken);
  const stepUpExpiresAt = dataProtectionStore((state) => state.stepUpExpiresAt);

  const previousGrant = React.useRef(grantToken);
  React.useEffect(() => {
    if (previousGrant.current !== grantToken) {
      previousGrant.current = grantToken;
      refresh();
    }
  }, [grantToken, refresh]);

  React.useEffect(() => {
    if (!grantToken) {
      return undefined;
    }
    const remaining = stepUpExpiresAt == null ? 0 : stepUpExpiresAt - Date.now();
    if (remaining <= 0) {
      // A remounted panel may reuse data revealed before expiry; its ordinary fetch can skip that cache.
      refresh();
      return undefined;
    }
    const timer = setTimeout(refresh, remaining + GRANT_EXPIRY_MARGIN_MS);
    return () => clearTimeout(timer);
  }, [grantToken, stepUpExpiresAt, refresh]);
};
