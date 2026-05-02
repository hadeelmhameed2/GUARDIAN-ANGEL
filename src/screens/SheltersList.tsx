import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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

import { getCurrentStatus, type RiskState } from '@/app/risk-status';
import { Fonts, PageGradient, Palette, Shadow } from '@/constants/theme';
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
const PAGE_GRADIENTS = PageGradient;

const normalize = (value: string) => value.trim().toLocaleLowerCase('he-IL');

export default function SheltersListScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const currentStatus = getCurrentStatus();

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
    router.back();
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
        <Text style={{ fontSize: 12, color: Palette.inkMuted, lineHeight: 12 }}>📍</Text>
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
        <Text style={{ fontSize: 14, color: '#FFFFFF', lineHeight: 14 }}>📞</Text>
        <Text style={styles.callButtonText}>Call Now</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <LinearGradient
      colors={PAGE_GRADIENTS[currentStatus]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.pageGradient}>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleBackToDashboard}
          accessibilityRole="button"
          accessibilityLabel="Back to App">
          <Text style={{ fontSize: 22, color: Palette.inkSoft, lineHeight: 22 }}>◀</Text>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Resources</Text>
          <Text style={styles.title}>Shelter Directory</Text>
        </View>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleQuickExit}
          accessibilityRole="button"
          accessibilityLabel="Emergency Exit">
          <Text style={{ fontSize: 18, color: Palette.inkSoft, lineHeight: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchInputWrap}>
          <Text style={[styles.searchIcon, { fontSize: 16, color: Palette.inkMuted, lineHeight: 16 }]}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by city or region..."
            placeholderTextColor={Palette.inkFaint}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            textAlign="left"
          />
        </View>
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
            <View style={styles.emptyIconWrap}>
              <Text style={{ fontSize: 28, color: Palette.primary, lineHeight: 28 }}>🔍</Text>
            </View>
            <Text style={styles.emptyTitle}>No matching resources</Text>
            <Text style={styles.emptySubtitle}>Try another city or region.</Text>
          </View>
        }
      />
    </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  pageGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  eyebrow: {
    color: Palette.inkMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    color: Palette.ink,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 4,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 999,
    paddingHorizontal: 18,
    ...Shadow.soft,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    color: Palette.ink,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#FFFCF9',
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  name: {
    flex: 1,
    color: Palette.ink,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    textAlign: 'left',
    writingDirection: 'ltr',
    lineHeight: 22,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Palette.primarySoft,
  },
  typeBadgeText: {
    color: Palette.primaryDeep,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: Palette.inkMuted,
    fontSize: 13,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  metaDivider: {
    color: Palette.inkFaint,
  },
  callButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.primary,
    borderRadius: 999,
    paddingVertical: 13,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  emptyState: {
    paddingVertical: 56,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: Palette.ink,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 6,
    color: Palette.inkMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
