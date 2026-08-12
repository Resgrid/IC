import { logger } from '@/lib/logging';
import useAuthStore from '@/stores/auth/store';
import { securityStore } from '@/stores/security/store';
import { useToastStore } from '@/stores/toast/store';

interface EnforceCommandAppAccessArgs {
  /** Already-localized denial text; the caller owns translation so language changes take effect. */
  deniedMessage: string;
  userId?: string | null;
}

/**
 * The IC app is for commanders. A member the department has not authorized must not get past
 * initialization — the server refuses them the board endpoints anyway, so signing them straight
 * back out is far clearer than an app that loads and then fails every request.
 *
 * The check is deliberately strict: only an explicit false denies. Rights that failed to load, or a
 * server old enough to omit the field, leave the session alone rather than locking a commander out.
 *
 * @returns true when the user was denied and signed out — the caller must stop initializing.
 */
export async function enforceCommandAppAccess({ deniedMessage, userId }: EnforceCommandAppAccessArgs): Promise<boolean> {
  if (securityStore.getState().rights?.CanLoginToCommandApp !== false) {
    return false;
  }

  logger.warn({ message: 'User is not authorized to use the IC app; signing out', context: { userId } });
  useToastStore.getState().showToast('error', deniedMessage);
  await useAuthStore.getState().logout();
  return true;
}
