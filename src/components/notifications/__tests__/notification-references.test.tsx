import { useNotifications } from '@novu/react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import { NotificationDetail } from '../NotificationDetail';
import { NotificationInbox, toNotificationPayload } from '../NotificationInbox';

// The real inbox and detail (the sibling NotificationInbox.test mocks the inbox itself), with the
// data sources mocked. Chat pushes reach the IC subscriber through the user-chat-message workflow,
// whose Novu bridge copies eventCode into the in-app `data`.
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@novu/react-native', () => ({ useNotifications: jest.fn() }));
jest.mock('@/api/novu/inbox', () => ({ deleteMessage: jest.fn() }));
jest.mock('@/stores/app/core-store', () => ({ useCoreStore: (selector: (state: unknown) => unknown) => selector({ config: { NovuApplicationId: 'app', NovuBackendApiUrl: 'api', NovuSocketUrl: 'socket' } }) }));
jest.mock('@/stores/toast/store', () => ({ useToastStore: (selector: (state: unknown) => unknown) => selector({ showToast: jest.fn() }) }));
jest.mock('@/lib/auth', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ userId: 'user-1' }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { type?: string }) => ({ 'notifications.view_chat': 'View Chat', 'notifications.view_reference': `View ${options?.type ?? ''}` })[key] ?? key,
  }),
}));

type NovuItem = Parameters<typeof toNotificationPayload>[0];
const item = (data: Record<string, unknown> | undefined, id = 'n-1') => ({ id, subject: 'Jane in Engine 6', body: 'On scene', createdAt: '2026-09-22T10:00:00Z', isRead: false, data }) as unknown as NovuItem;

describe('inbox chat references', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps direct and group chat codes to the conversation and keeps the code out of the details', () => {
    const direct = toNotificationPayload(item({ eventCode: 't:9a2b' }));
    expect(direct.referenceType).toBe('chat');
    expect(direct.referenceId).toBe('9a2b');
    expect(direct.metadata).toEqual({});

    const group = toNotificationPayload(item({ eventCode: 'g:7f1c' }));
    expect(group.referenceType).toBe('chat');
    expect(group.referenceId).toBe('7f1c');
  });

  it('treats a generic N notification as title and body only, with nothing to open', () => {
    for (const eventCode of ['N4321', 'n4321', 'N:4321']) {
      const payload = toNotificationPayload(item({ eventCode }));
      expect(payload.referenceType).toBeUndefined();
      expect(payload.referenceId).toBeUndefined();
      expect(payload.title).toBe('Jane in Engine 6');
      expect(payload.body).toBe('On scene');
    }
  });

  it('keeps call codes and ignores chat ids that could steer the router', () => {
    expect(toNotificationPayload(item({ eventCode: 'C1234' }))).toEqual(expect.objectContaining({ referenceType: 'call', referenceId: '1234' }));
    expect(toNotificationPayload(item({ eventCode: 'g:../call/9' })).referenceType).toBeUndefined();
    expect(toNotificationPayload(item({ eventCode: '' })).referenceType).toBeUndefined();
    expect(toNotificationPayload(item(undefined)).referenceType).toBeUndefined();
  });

  it('opens the conversation from the inbox row and closes the inbox', () => {
    (useNotifications as jest.Mock).mockReturnValue({ notifications: [item({ eventCode: 'g:7f1c' }, 'chat-1')], isLoading: false, fetchMore: jest.fn(), hasMore: false, refetch: jest.fn() });
    const onClose = jest.fn();

    const { unmount } = render(<NotificationInbox isOpen onClose={onClose} />);
    fireEvent.press(screen.getByTestId('notification-reference-chat-1'));

    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/chat/[channelId]', params: { channelId: '7f1c' } });
    unmount();
  });

  it('labels the detail button for a chat reference', () => {
    const onNavigateToReference = jest.fn();
    const { unmount } = render(
      <NotificationDetail
        notification={{ id: 'n-1', title: 'Jane', body: 'On scene', createdAt: '2026-09-22T10:00:00Z', referenceType: 'chat', referenceId: '7f1c' }}
        onClose={jest.fn()}
        onDelete={jest.fn()}
        onNavigateToReference={onNavigateToReference}
      />
    );

    fireEvent.press(screen.getByText('View Chat'));
    expect(onNavigateToReference).toHaveBeenCalledWith('chat', '7f1c');
    unmount();
  });
});
