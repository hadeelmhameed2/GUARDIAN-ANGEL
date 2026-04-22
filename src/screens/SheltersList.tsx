import { useRouter } from 'expo-router';
import { ArrowLeft, Phone, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import sheltersData from '@/data/shelters.json';

type Shelter = {
  id: string;
  region: string;
  city: string;
  name: string;
  phone: string;
  type: string;
};

const SHELTERS = sheltersData as Shelter[];

const normalize = (value: string) => value.trim().toLocaleLowerCase('he-IL');

export default function SheltersListScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return SHELTERS;
    return SHELTERS.filter(
      (item) => normalize(item.city).includes(q) || normalize(item.region).includes(q),
    );
  }, [query]);

  const handleQuickExit = () => {
    router.replace('/(tabs)');
  };

  const handleBackToDashboard = () => {
    router.replace('/home');
  };

  const handleCall = async (phone: string) => {
    const sanitized = phone.replace(/\s+/g, '');
    if (!sanitized) {
      Alert.alert('Error', 'Phone number is unavailable.');
      return;
    }
    const telUrl = `tel:${sanitized}`;
    try {
      const canOpen = await Linking.canOpenURL(telUrl);
      if (!canOpen) {
        Alert.alert('Unavailable', 'Dialer is not available on this device.');
        return;
      }
      // Keep the user on this screen after the call flow.
      await Linking.openURL(telUrl);
    } catch {
      Alert.alert('Error', 'Something went wrong while trying to place the call.');
    }
  };

  const renderItem = ({ item }: { item: Shelter }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{item.type}</Text>
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {item.city}
          <Text style={styles.metaDivider}>  ·  </Text>
          {item.region}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.callButton}
        activeOpacity={0.85}
        onPress={() => void handleCall(item.phone)}
        accessibilityRole="button"
        accessibilityLabel={`Call ${item.name}`}>
        <Text style={styles.callButtonText}>Call Now</Text>
        <Phone size={15} color="#e2e8f0" strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBackToDashboard}
          accessibilityRole="button"
          accessibilityLabel="Back to App">
          <ArrowLeft size={18} color="#e5e7eb" strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Resource & Shelter Directory</Text>
          <Text style={styles.subtitle}>Discreet Search. Available Resources.</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleQuickExit}
          accessibilityRole="button"
          accessibilityLabel="Emergency Exit">
          <X size={18} color="#e5e7eb" strokeWidth={2.4} />
        </TouchableOpacity>
      </View>
      <Text style={styles.headerHint}>← Back to App  |  X Emergency Exit</Text>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by city or region..."
          placeholderTextColor="#64748b"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          textAlign="right"
          writingDirection="rtl"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matching resources found</Text>
            <Text style={styles.emptySubtitle}>Try another city or region.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: 10,
  },
  title: {
    color: '#f8fafc',
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 2,
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  headerHint: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchInput: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#f1f5f9',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 4,
  },
  card: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  name: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 22,
  },
  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeBadgeText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  metaRow: {
    marginTop: 8,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metaDivider: {
    color: '#475569',
  },
  callButton: {
    marginTop: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 11,
  },
  callButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptySubtitle: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
