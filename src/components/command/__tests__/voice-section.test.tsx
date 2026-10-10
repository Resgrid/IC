import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${Object.values(params).join('/')}` : key),
  }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) => React.createElement('View', { ...props, testID: `mock-${name}-icon` });
  return {
    ChevronLeft: icon('chevron-left'),
    ChevronRight: icon('chevron-right'),
    Mic: icon('mic'),
    MicOff: icon('mic-off'),
    Phone: icon('phone'),
    PhoneOff: icon('phone-off'),
    Plus: icon('plus'),
    RadioTower: icon('radio-tower'),
  };
});

const mockConnectToRoom = jest.fn();
const mockDisconnect = jest.fn();
const mockSetMic = jest.fn();
const mockFetchVoiceSettings = jest.fn();

let mockLiveKitState: Record<string, unknown>;

jest.mock('@/stores/app/livekit-store', () => ({
  useLiveKitStore: Object.assign((selector: any) => selector(mockLiveKitState), { getState: () => mockLiveKitState }),
}));

import type { IncidentVoiceChannel, VoiceTransmissionLog } from '@/models/v4/incidentCommand/incidentCommandModels';

import { VoiceSection } from '../voice-section';

const channel: IncidentVoiceChannel = { DepartmentVoiceChannelId: 'ch-1', DepartmentId: 1, CallId: 101, Name: 'Tactical 1', IsOnDemand: true };

const log: VoiceTransmissionLog = { VoiceTransmissionLogId: 'tx-1', DepartmentId: 1, CallId: 101, DepartmentVoiceChannelId: 'ch-1', UserId: 'u-1', StartedOn: '2026-07-19T10:00:00Z', EndedOn: '2026-07-19T10:00:04Z' };

/** Newest first, like the API returns them: tx-0 is the latest transmission. */
const manyLogs = (count: number): VoiceTransmissionLog[] => Array.from({ length: count }, (_, i) => ({ ...log, VoiceTransmissionLogId: `tx-${i}` }));

const baseProps = {
  callId: '101',
  channels: [channel],
  transmissionLog: [log],
  personName: (userId: string) => (userId === 'u-1' ? 'Sam Jones' : userId),
  onCreateChannel: jest.fn(),
  onCloseChannels: jest.fn(),
  onTransmission: jest.fn(),
};

describe('VoiceSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLiveKitState = {
      availableRooms: [{ Id: 'ch-1', Name: 'Tactical 1', Token: 'tok-1' }],
      currentRoomInfo: null,
      isMicrophoneEnabled: false,
      connectToRoom: mockConnectToRoom,
      disconnectFromRoom: mockDisconnect,
      setMicrophoneEnabled: mockSetMic,
      fetchVoiceSettings: mockFetchVoiceSettings,
    };
  });

  it('lists channels and joins via the LiveKit room token', async () => {
    const { getByTestId, getByText, unmount } = render(<VoiceSection {...baseProps} />);

    expect(getByTestId('voice-channel-ch-1')).toBeTruthy();
    fireEvent.press(getByTestId('voice-join-ch-1'));
    await Promise.resolve();
    expect(mockConnectToRoom).toHaveBeenCalledWith(expect.objectContaining({ Id: 'ch-1' }), 'tok-1');

    unmount();
  });

  it('shows PTT and leave controls when connected and records a transmission on mic release', () => {
    mockLiveKitState.currentRoomInfo = { Id: 'ch-1', Name: 'Tactical 1' };
    mockLiveKitState.isMicrophoneEnabled = true;
    const { getByTestId, rerender, unmount } = render(<VoiceSection {...baseProps} />);

    expect(getByTestId('voice-ptt-ch-1')).toBeTruthy();

    // Mic released → the completed transmission is logged
    mockLiveKitState = { ...mockLiveKitState, isMicrophoneEnabled: false };
    rerender(<VoiceSection {...baseProps} />);
    expect(baseProps.onTransmission).toHaveBeenCalledWith('ch-1', expect.any(String), expect.any(String));

    fireEvent.press(getByTestId('voice-leave-ch-1'));
    expect(mockDisconnect).toHaveBeenCalled();

    unmount();
  });

  it('creates a channel from a preset name', () => {
    const { getByTestId, unmount } = render(<VoiceSection {...baseProps} channels={[]} transmissionLog={[]} />);

    fireEvent.press(getByTestId('command-voice-add'));
    fireEvent.press(getByTestId('channel-preset-channel_preset_tactical'));
    fireEvent.press(getByTestId('channel-create'));
    expect(baseProps.onCreateChannel).toHaveBeenCalledWith('command.channel_preset_tactical');

    unmount();
  });

  it('renders the transmission log with speaker, channel, and duration', () => {
    const { getByTestId, getByText, unmount } = render(<VoiceSection {...baseProps} />);

    expect(getByTestId('command-transmission-log')).toBeTruthy();
    expect(getByText('Sam Jones')).toBeTruthy();
    expect(getByText('command.transmission_seconds:4')).toBeTruthy();

    unmount();
  });

  it('pages through the transmission history ten at a time', () => {
    const { getByTestId, queryByTestId, unmount } = render(<VoiceSection {...baseProps} transmissionLog={manyLogs(25)} />);

    expect(getByTestId('transmission-tx-0')).toBeTruthy();
    expect(getByTestId('transmission-tx-9')).toBeTruthy();
    expect(queryByTestId('transmission-tx-10')).toBeNull();
    expect(getByTestId('command-transmission-page').props.children).toBe('command.transmission_log_page:1/3');

    // Already on the newest page
    fireEvent.press(getByTestId('command-transmission-prev'));
    expect(getByTestId('command-transmission-page').props.children).toBe('command.transmission_log_page:1/3');

    fireEvent.press(getByTestId('command-transmission-next'));
    expect(queryByTestId('transmission-tx-0')).toBeNull();
    expect(getByTestId('transmission-tx-10')).toBeTruthy();
    expect(getByTestId('transmission-tx-19')).toBeTruthy();
    expect(getByTestId('command-transmission-page').props.children).toBe('command.transmission_log_page:2/3');

    // The last page holds the remainder and goes no further
    fireEvent.press(getByTestId('command-transmission-next'));
    fireEvent.press(getByTestId('command-transmission-next'));
    expect(getByTestId('transmission-tx-24')).toBeTruthy();
    expect(queryByTestId('transmission-tx-19')).toBeNull();
    expect(getByTestId('command-transmission-page').props.children).toBe('command.transmission_log_page:3/3');

    fireEvent.press(getByTestId('command-transmission-prev'));
    expect(getByTestId('command-transmission-page').props.children).toBe('command.transmission_log_page:2/3');

    unmount();
  });

  it('caps the transmission log height and hides paging when one page is enough', () => {
    const { getByTestId, queryByTestId, unmount } = render(<VoiceSection {...baseProps} transmissionLog={manyLogs(10)} />);

    expect(StyleSheet.flatten(getByTestId('command-transmission-list').props.style).maxHeight).toBe(360);
    expect(getByTestId('transmission-tx-9')).toBeTruthy();
    expect(queryByTestId('command-transmission-pagination')).toBeNull();

    unmount();
  });

  it('starts a different incident on its newest page and clamps when the log shrinks', () => {
    const { getByTestId, rerender, unmount } = render(<VoiceSection {...baseProps} transmissionLog={manyLogs(25)} />);

    fireEvent.press(getByTestId('command-transmission-next'));
    fireEvent.press(getByTestId('command-transmission-next'));
    expect(getByTestId('command-transmission-page').props.children).toBe('command.transmission_log_page:3/3');

    // Same incident, fewer entries: stay on the last page that still exists
    rerender(<VoiceSection {...baseProps} transmissionLog={manyLogs(15)} />);
    expect(getByTestId('command-transmission-page').props.children).toBe('command.transmission_log_page:2/2');
    expect(getByTestId('transmission-tx-14')).toBeTruthy();

    // Switching incidents resets to the newest page
    rerender(<VoiceSection {...baseProps} callId="202" transmissionLog={manyLogs(25)} />);
    expect(getByTestId('command-transmission-page').props.children).toBe('command.transmission_log_page:1/3');
    expect(getByTestId('transmission-tx-0')).toBeTruthy();

    unmount();
  });
});
