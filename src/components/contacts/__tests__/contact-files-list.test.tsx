import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React from 'react';

import { getContactFileBase64 } from '@/api/contacts/contactFiles';
import { type ContactFileResultData } from '@/models/v4/contactFiles/contactFilesResult';

import { ContactFilesList } from '../contact-files-list';

interface MockChildrenProps {
  children?: React.ReactNode;
  testID?: string;
}

interface MockButtonProps extends MockChildrenProps {
  onPress?: () => void;
}

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

jest.mock('lucide-react-native', () => ({
  DownloadIcon: () => null,
  FileIcon: () => null,
  LockIcon: () => null,
  PaperclipIcon: () => null,
}));

jest.mock('@/api/contacts/contactFiles', () => ({
  getContactFileBase64: jest.fn(),
}));

jest.mock('@/hooks/use-analytics', () => {
  const trackEvent = jest.fn();
  return { useAnalytics: () => ({ trackEvent }) };
});

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/components/data-protection/protected-text', () => {
  const { Text } = require('react-native');
  return { ProtectedText: ({ value }: { value?: string | null }) => <Text>{value}</Text> };
});

jest.mock('@/components/ui/button', () => {
  const { TouchableOpacity } = require('react-native');
  return {
    Button: ({ children, onPress, testID }: MockButtonProps) => (
      <TouchableOpacity onPress={onPress} testID={testID}>
        {children}
      </TouchableOpacity>
    ),
    ButtonIcon: () => null,
  };
});

jest.mock('@/components/ui/box', () => {
  const { View } = require('react-native');
  return { Box: ({ children, testID }: MockChildrenProps) => <View testID={testID}>{children}</View> };
});

jest.mock('@/components/ui/hstack', () => {
  const { View } = require('react-native');
  return { HStack: ({ children, testID }: MockChildrenProps) => <View testID={testID}>{children}</View> };
});

jest.mock('@/components/ui/vstack', () => {
  const { View } = require('react-native');
  return { VStack: ({ children, testID }: MockChildrenProps) => <View testID={testID}>{children}</View> };
});

jest.mock('@/components/ui/spinner', () => ({ Spinner: () => null }));

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text };
});

const mockGetContactFileBase64 = getContactFileBase64 as jest.MockedFunction<typeof getContactFileBase64>;
const mockWrite = FileSystem.writeAsStringAsync as jest.MockedFunction<typeof FileSystem.writeAsStringAsync>;
const mockMakeDirectory = FileSystem.makeDirectoryAsync as jest.MockedFunction<typeof FileSystem.makeDirectoryAsync>;
const mockShare = Sharing.shareAsync as jest.MockedFunction<typeof Sharing.shareAsync>;

const contactFile = (id: string, fileName: string): ContactFileResultData => ({
  IsProtected: false,
  RedactedFields: [],
  Id: id,
  ContactId: 'c1',
  Type: 1,
  TypeName: 'Pre-plan',
  Name: 'Site plan',
  FileName: fileName,
  Mime: 'application/pdf',
  Size: 2048,
  Timestamp: '2026-09-25',
});

describe('ContactFilesList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetContactFileBase64.mockResolvedValue('JVBERi0=');
  });

  it('gives two files with the same name their own paths, keeping the real name', async () => {
    const files = [contactFile('f1', 'report.pdf'), contactFile('f2', 'report.pdf')];

    const { unmount } = render(<ContactFilesList files={files} />);
    fireEvent.press(screen.getByTestId('contact-file-download-f1'));
    fireEvent.press(screen.getByTestId('contact-file-download-f2'));

    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(2));
    const written = mockWrite.mock.calls.map((call) => call[0]);
    expect(written).toEqual(['file:///docs/contact-files/f1/report.pdf', 'file:///docs/contact-files/f2/report.pdf']);
    expect(mockMakeDirectory).toHaveBeenCalledWith('file:///docs/contact-files/f1/', { intermediates: true });
    unmount();
  });

  it('keeps a server file name that carries a path inside the file folder', async () => {
    const { unmount } = render(<ContactFilesList files={[contactFile('f3', '../../escape/plan.pdf')]} />);
    fireEvent.press(screen.getByTestId('contact-file-download-f3'));

    await waitFor(() => expect(mockWrite).toHaveBeenCalledWith('file:///docs/contact-files/f3/plan.pdf', 'JVBERi0=', { encoding: 'base64' }));
    unmount();
  });
});
