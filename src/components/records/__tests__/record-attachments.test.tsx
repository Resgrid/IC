import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import React from 'react';

import { getRecordAttachments } from '@/api/records/record-uploads';
import { fileSize, hashFile, MAX_ATTACHMENT_BYTES } from '@/lib/records/uploads';
import { useRecordsStore } from '@/stores/records/store';

import { RecordAttachments } from '../record-attachments';

interface MockChildrenProps {
  children?: React.ReactNode;
  testID?: string;
}

interface MockButtonProps extends MockChildrenProps {
  onPress?: () => void;
}

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('react-i18next', () => {
  const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key);
  return { useTranslation: () => ({ t }) };
});

jest.mock('lucide-react-native', () => ({
  Camera: () => null,
  FileUp: () => null,
  Images: () => null,
  MapPin: () => null,
  RefreshCw: () => null,
  Trash2: () => null,
  TriangleAlert: () => null,
}));

jest.mock('@/api/records/record-uploads', () => ({
  getRecordAttachments: jest.fn(),
  removeRecordAttachment: jest.fn(),
}));

jest.mock('@/lib/records/uploads', () => ({
  MAX_ATTACHMENT_BYTES: 25 * 1024 * 1024,
  fileSize: jest.fn(),
  hashFile: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/stores/records/store', () => ({
  useRecordsStore: jest.fn(),
}));

jest.mock('@/components/ui/button', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Button: ({ children, onPress, testID }: MockButtonProps) => (
      <TouchableOpacity onPress={onPress} testID={testID}>
        {children}
      </TouchableOpacity>
    ),
    ButtonIcon: () => null,
    ButtonText: ({ children }: MockChildrenProps) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/badge', () => {
  const { Text, View } = require('react-native');
  return {
    Badge: ({ children }: MockChildrenProps) => <View>{children}</View>,
    BadgeText: ({ children }: MockChildrenProps) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/box', () => {
  const { View } = require('react-native');
  return { Box: ({ children, testID }: MockChildrenProps) => <View testID={testID}>{children}</View> };
});

jest.mock('@/components/ui/divider', () => ({ Divider: () => null }));

jest.mock('@/components/ui/heading', () => {
  const { Text } = require('react-native');
  return { Heading: ({ children }: MockChildrenProps) => <Text>{children}</Text> };
});

jest.mock('@/components/ui/hstack', () => {
  const { View } = require('react-native');
  return { HStack: ({ children }: MockChildrenProps) => <View>{children}</View> };
});

jest.mock('@/components/ui/vstack', () => {
  const { View } = require('react-native');
  return { VStack: ({ children }: MockChildrenProps) => <View>{children}</View> };
});

jest.mock('@/components/ui/pressable', () => {
  const { TouchableOpacity } = require('react-native');
  return { Pressable: ({ children, onPress, testID }: MockButtonProps) => <TouchableOpacity onPress={onPress} testID={testID}>{children}</TouchableOpacity> };
});

jest.mock('@/components/ui/progress', () => ({
  Progress: () => null,
  ProgressFilledTrack: () => null,
}));

jest.mock('@/components/ui/spinner', () => ({ Spinner: () => null }));

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text };
});

const mockGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.MockedFunction<typeof DocumentPicker.getDocumentAsync>;
const mockFileSize = fileSize as jest.MockedFunction<typeof fileSize>;
const mockHashFile = hashFile as jest.MockedFunction<typeof hashFile>;
const mockUseRecordsStore = useRecordsStore as unknown as jest.Mock;

const store = {
  pendingUploads: {},
  uploadProgress: {},
  stageUpload: jest.fn(),
  runUploads: jest.fn(),
  retryUpload: jest.fn(),
  discardUpload: jest.fn(),
};

const pick = (name: string) => mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: `file:///cache/${name}`, name, mimeType: 'video/mp4' }] } as never);

describe('RecordAttachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRecordsStore.mockImplementation((selector: (state: typeof store) => unknown) => selector(store));
    (getRecordAttachments as jest.Mock).mockResolvedValue({ Data: [] });
    store.runUploads.mockResolvedValue({ uploaded: 1, failed: 0 });
    mockHashFile.mockResolvedValue('abc');
  });

  it('refuses a file over the attachment ceiling before reading it', async () => {
    pick('bodycam.mp4');
    mockFileSize.mockResolvedValue(MAX_ATTACHMENT_BYTES + 1);

    const { unmount } = render(<RecordAttachments recordId="r1" allowAttachments />);
    fireEvent.press(screen.getByTestId('record-attachment-file'));

    expect(await screen.findByText('records.attachment_too_large:{"size":25}')).toBeTruthy();
    expect(mockHashFile).not.toHaveBeenCalled();
    expect(store.stageUpload).not.toHaveBeenCalled();
    unmount();
  });

  it('hashes and stages a file at the ceiling', async () => {
    pick('scene.mp4');
    mockFileSize.mockResolvedValue(MAX_ATTACHMENT_BYTES);

    const { unmount } = render(<RecordAttachments recordId="r1" allowAttachments />);
    fireEvent.press(screen.getByTestId('record-attachment-file'));

    await waitFor(() => expect(store.stageUpload).toHaveBeenCalledWith(expect.objectContaining({ recordId: 'r1', fileName: 'scene.mp4', byteSize: MAX_ATTACHMENT_BYTES, sha256: 'abc' })));
    expect(mockHashFile).toHaveBeenCalledWith('file:///cache/scene.mp4');
    unmount();
  });
});
