import AsyncStorage from '@react-native-async-storage/async-storage';

export type EmergencyContact = {
  name: string;
  phone: string;
  email: string;
};

const EMERGENCY_CONTACT_KEY = 'core-emergency-contact-v1';

const EMPTY_CONTACT: EmergencyContact = {
  name: '',
  phone: '',
  email: '',
};

function normalizeContact(contact?: Partial<EmergencyContact> | null): EmergencyContact {
  return {
    name: contact?.name?.trim() ?? '',
    phone: contact?.phone?.trim() ?? '',
    email: contact?.email?.trim() ?? '',
  };
}

export async function getEmergencyContact(): Promise<EmergencyContact> {
  try {
    const raw = await AsyncStorage.getItem(EMERGENCY_CONTACT_KEY);
    if (!raw) return EMPTY_CONTACT;
    return normalizeContact(JSON.parse(raw) as Partial<EmergencyContact>);
  } catch {
    return EMPTY_CONTACT;
  }
}

export async function saveEmergencyContact(contact: EmergencyContact): Promise<void> {
  const normalized = normalizeContact(contact);
  await AsyncStorage.setItem(EMERGENCY_CONTACT_KEY, JSON.stringify(normalized));
}
