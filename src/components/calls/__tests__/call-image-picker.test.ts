import * as ImagePicker from 'expo-image-picker';

import { launchCallImagePicker } from '@/components/calls/call-image-picker';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

const mockLaunchImageLibraryAsync = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<typeof ImagePicker.launchImageLibraryAsync>;

describe('launchCallImagePicker', () => {
  it('uses the non-legacy system image picker without requesting broad media access', async () => {
    const pickerResult: ImagePicker.ImagePickerResult = {
      assets: null,
      canceled: true,
    };
    mockLaunchImageLibraryAsync.mockResolvedValue(pickerResult);

    await expect(launchCallImagePicker()).resolves.toBe(pickerResult);
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      legacy: false,
    });
  });
});
