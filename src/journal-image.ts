import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export type PickedJournalImage = {
  base64: string;
  name: string;
};

export async function pickJournalImageNative(): Promise<PickedJournalImage | null> {
  if (Platform.OS === 'web') return null;
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission needed', 'Allow photo access to attach an image.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions
      ? ImagePicker.MediaTypeOptions.Images
      : (['images'] as any),
    base64: true,
    quality: 0.6,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType ?? 'image/jpeg';
  return {
    base64: `data:${mime};base64,${asset.base64}`,
    name: asset.fileName ?? 'photo',
  };
}
