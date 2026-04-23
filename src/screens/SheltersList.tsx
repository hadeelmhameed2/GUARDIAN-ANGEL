import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { getCurrentStatus, type RiskState } from '@/app/risk-status';
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
const PAGE_GRADIENTS: Record<RiskState, [string, string, string]> = {
  red: ['#FFD6D6', '#FAF3E0', '#FAF3E0'],
  yellow: ['#FFE8D1', '#FAF3E0', '#FAF3E0'],
  green: ['#E8F5E9', '#FAF3E0', '#FAF3E0'],
};
const BRANCH_TINT: Record<RiskState, string> = {
  red: '#9f4b4b',
  yellow: '#a8692e',
  green: '#4d6d52',
};

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
        <Text style={styles.callButtonEmoji}>📞</Text>
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
      <View pointerEvents="none" style={styles.branchOverlayWrap}>
        <Image
          source={require('../../assets/images/traffic-light-bg.png')}
          style={[styles.branchOverlay, { tintColor: BRANCH_TINT[currentStatus] }]}
        />
      </View>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleBackToDashboard}
          accessibilityRole="button"
          accessibilityLabel="Back to App">
          <Image source={require('../../assets/images/turn-back.png')} style={styles.backArrowImage} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Resource & Shelter Directory</Text>
          <Text style={styles.subtitle}>Discreet Search. Available Resources.</Text>
        </View>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleQuickExit}
          accessibilityRole="button"
          accessibilityLabel="Emergency Exit">
          <Image source={require('../../assets/images/image_10.png')} style={styles.stealthExitImage} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={16} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by city or region..."
            placeholderTextColor="#9CA3AF"
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
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No matching resources found</Text>
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
  branchOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  branchOverlay: {
    position: 'absolute',
    bottom: -90,
    right: -35,
    width: 420,
    height: 520,
    opacity: 0.15,
    transform: [{ rotate: '-14deg' }],
    zIndex: 0,
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
    color: '#2D3436',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'left',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 3,
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'left',
    fontWeight: '500',
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backArrowImage: {
    width: 25,
    height: 25,
    resizeMode: 'contain',
    tintColor: '#374151',
  },
  stealthExitImage: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 6,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    color: '#2D3436',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  name: {
    flex: 1,
    color: '#2D3436',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
    lineHeight: 22,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E8F5E9',
  },
  typeBadgeText: {
    color: '#5F7A61',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  metaRow: {
    marginTop: 8,
  },
  metaText: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  metaDivider: {
    color: '#D1D5DB',
  },
  callButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5F7A61',
    borderRadius: 16,
    paddingVertical: 12,
  },
  callButtonEmoji: {
    fontSize: 14,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'left',
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#2D3436',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  emptySubtitle: {
    marginTop: 6,
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});
