import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import apiClient, { API_BASE } from '../api/client';
import { COLORS, FONTS } from '../constants/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 36) / 2;

function getImageUri(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

function AvatarCircle({ name, size = 72 }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

export default function SellerProfileScreen({ route, navigation }) {
  const { user_id } = route.params;

  const [seller, setSeller] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSellerProfile();
  }, [user_id]);

  const fetchSellerProfile = async () => {
    try {
      const response = await apiClient.get(`/seller/${user_id}`);
      const data = response.data;
      setSeller(data.seller || data.user || data);
      setListings(data.listings || data.fish || []);
    } catch {
      Alert.alert('오류', '판매자 정보를 불러오지 못했습니다.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const renderFishCard = ({ item }) => {
    const rawImage = item.images?.length > 0 ? item.images[0] : null;
    const imageUri = getImageUri(rawImage);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('FishDetail', { fish_id: item.id })}
        activeOpacity={0.8}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardImagePlaceholderText}>🐠</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          {item.species ? (
            <View style={styles.speciesTag}>
              <Text style={styles.speciesTagText}>{item.species}</Text>
            </View>
          ) : null}
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardPrice}>
            {item.price != null ? `${Number(item.price).toLocaleString()}원` : '가격 문의'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const activeListings = listings.filter((l) => l.status !== '판매완료');

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderFishCard}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.profileSection}>
              <AvatarCircle name={seller?.username} size={72} />
              <Text style={styles.username}>{seller?.username || '알 수 없음'}</Text>
              {seller?.bio ? (
                <Text style={styles.bio}>{seller.bio}</Text>
              ) : (
                <Text style={styles.bioPlaceholder}>자기소개가 없습니다</Text>
              )}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{listings.length}</Text>
                  <Text style={styles.statLabel}>총 판매</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{activeListings.length}</Text>
                  <Text style={styles.statLabel}>판매중</Text>
                </View>
              </View>
            </View>

            <View style={styles.listingsHeader}>
              <Text style={styles.listingsHeaderText}>판매 중인 상품</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{listings.length}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🐟</Text>
            <Text style={styles.emptyText}>등록된 상품이 없습니다</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  profileSection: {
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 10,
  },
  avatarCircle: {
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: FONTS.extrabold,
  },
  username: {
    fontSize: 20,
    fontWeight: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  bio: {
    fontSize: 14,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  bioPlaceholder: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginBottom: 18,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    gap: 40,
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: FONTS.extrabold,
    color: COLORS.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSub,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  listingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 4,
  },
  listingsHeaderText: {
    fontSize: 15,
    fontWeight: FONTS.bold,
    color: COLORS.text,
  },
  countBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: FONTS.bold,
  },
  row: {
    paddingHorizontal: 12,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 0.8,
    backgroundColor: COLORS.divider,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: CARD_WIDTH * 0.8,
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImagePlaceholderText: {
    fontSize: 36,
  },
  cardBody: {
    padding: 10,
  },
  speciesTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 5,
  },
  speciesTagText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: FONTS.medium,
  },
  cardTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: FONTS.medium,
    lineHeight: 18,
    marginBottom: 5,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: FONTS.bold,
    color: COLORS.text,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
});
