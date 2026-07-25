import * as ImagePicker from 'expo-image-picker';

export const launchCallImagePicker = (): Promise<ImagePicker.ImagePickerResult> =>
  ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
    legacy: false,
  });
