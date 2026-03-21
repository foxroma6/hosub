import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import apiClient, { API_BASE } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { COLORS, FONTS } from '../constants/colors';

function getImageUri(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function AvatarCircle({ name, size = 60 }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

export default function MyPageScreen({ navigation }) {
  const { user: authUser, logout } = useContext(AuthContext);

  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bio, setBio] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [editingBio, setEditingBio] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    try {
      const [meResponse, listingsResponse] = await Promise.all([
        apiClient.get('/me'),
        apiClient.get('/me/listings'),
      ]);
      const userData = meResponse.data;
      setProfile(userData);
      setBio(userData.bio || '');
      setListings(listingsResponse.data.listings || listingsResponse.data || []);
    } catch {
      if (!silent && authUser) {
        setProfile(authUser);
        setBio(authUser.bio || '');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) {
      setProfile(authUser);
      setBio(authUser.bio || '');
      setLoading(false);
      fetchData(true);
    } else {
      fetchData(false);
    }
  }, [authUser]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSaveBio = async () => {
    setBioSaving(true);
    try {
      await apiClient.patch('/me/bio', { bio: bio.trim() });
      setProfile((prev) => ({ ...prev, bio: bio.trim() }));
      setEditingBio(false);
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setBioSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => { await logout(); },
      },
    ]);
  };

  const renderListing = ({ item }) => {
    const rawImage = item.images?.length > 0 ? item.images[0] : null;
    const imageUri = getImageUri(rawImage);

    return (
      <TouchableOpacity
        style={styles.listingItem}
        onPress={() => navigation.navigate('FishDetail', { fish_id: item.id })}
        activeOpacity={0.7}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.listingImage} resizeMode="cover" />
        ) : (
          <View style={styles.listingImagePlaceholder}>
            <Text style={styles.listingImagePlaceholderText}>🐠</Text>
          </View>
        )}
        <View style={styles.listingBody}>
          <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
          {item.species ? (
            <View style={styles.speciesTag}>
              <Text style={styles.speciesTagText}>{item.species}</Text>
            </View>
          ) : null}
          <Text style={styles.listingPrice}>
            {item.price != null ? `${Number(item.price).toLocaleString()}원` : '가격 문의'}
          </Text>
          <Text style={styles.listingMeta}>
            {item.location ? `${item.location} · ` : ''}
            {formatDate(item.created_at)}
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

  const displayUser = profile || authUser;

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderListing}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>MY</Text>
            </View>

            {/* Profile Section */}
            <View style={styles.profileSection}>
              <AvatarCircle name={displayUser?.username} size={60} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileUsername}>
                  {displayUser?.username || '-'}
                </Text>
                <Text style={styles.profileEmail}>
                  {displayUser?.email || '-'}
                </Text>
                <TouchableOpacity
                  style={styles.editBioBtn}
                  onPress={() => setEditingBio(!editingBio)}
                >
                  <Text style={styles.editBioBtnText}>
                    {editingBio ? '취소' : '자기소개 수정'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bio */}
            {editingBio ? (
              <View style={styles.bioEditSection}>
                <TextInput
                  style={styles.bioInput}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="자기소개를 입력해주세요..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.bioSaveButton, bioSaving && styles.bioSaveButtonDisabled]}
                  onPress={handleSaveBio}
                  disabled={bioSaving}
                >
                  {bioSaving ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.bioSaveButtonText}>저장</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.bioDisplaySection}>
                <Text style={[styles.bioText, !displayUser?.bio && styles.bioTextEmpty]}>
                  {displayUser?.bio || '자기소개를 작성해보세요'}
                </Text>
              </View>
            )}

            <View style={styles.menuDivider} />

            {/* Menu Items */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('SellerProfile', { user_id: displayUser?.id })}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemLabel}>내 프로필 보기</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <Text style={styles.menuItemLabel}>판매 상품 관리</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{listings.length}</Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            {/* Listings Header */}
            <View style={styles.listingsHeader}>
              <Text style={styles.listingsHeaderText}>내 판매 상품</Text>
              <Text style={styles.listingsCount}>{listings.length}개</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🐟</Text>
            <Text style={styles.emptyText}>등록한 상품이 없습니다</Text>
            <TouchableOpacity
              style={styles.addListingButton}
              onPress={() => navigation.navigate('NewFish')}
            >
              <Text style={styles.addListingButtonText}>상품 등록하기</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          listings.length > 0 ? (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>로그아웃</Text>
            </TouchableOpacity>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {listings.length === 0 && (
        <TouchableOpacity style={styles.logoutBtnFixed} onPress={handleLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: FONTS.bold,
    color: COLORS.text,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  avatarCircle: {
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: FONTS.bold,
  },
  profileInfo: {
    flex: 1,
  },
  profileUsername: {
    fontSize: 18,
    fontWeight: FONTS.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.textSub,
    marginBottom: 8,
  },
  editBioBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editBioBtnText: {
    fontSize: 12,
    color: COLORS.textSub,
    fontWeight: FONTS.medium,
  },
  bioDisplaySection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  bioText: {
    fontSize: 14,
    color: COLORS.textSub,
    lineHeight: 20,
  },
  bioTextEmpty: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  bioEditSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 10,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  bioSaveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  bioSaveButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  bioSaveButtonText: {
    color: '#FFFFFF',
    fontWeight: FONTS.bold,
    fontSize: 14,
  },
  menuDivider: {
    height: 8,
    backgroundColor: COLORS.divider,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  menuItemLabel: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: FONTS.medium,
  },
  menuItemArrow: {
    fontSize: 18,
    color: COLORS.textSub,
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
  listingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listingsHeaderText: {
    fontSize: 15,
    fontWeight: FONTS.bold,
    color: COLORS.text,
  },
  listingsCount: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  listingItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 14,
    alignItems: 'flex-start',
  },
  listingImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: COLORS.divider,
  },
  listingImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingImagePlaceholderText: {
    fontSize: 30,
  },
  listingBody: {
    flex: 1,
    paddingTop: 2,
  },
  listingTitle: {
    fontSize: 15,
    fontWeight: FONTS.semibold,
    color: COLORS.text,
    lineHeight: 21,
    marginBottom: 4,
  },
  speciesTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  speciesTagText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: FONTS.medium,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: FONTS.bold,
    color: COLORS.text,
    marginBottom: 3,
  },
  listingMeta: {
    fontSize: 12,
    color: COLORS.textSub,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  addListingButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  addListingButtonText: {
    color: '#FFFFFF',
    fontWeight: FONTS.bold,
    fontSize: 14,
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  logoutBtnFixed: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  logoutText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: FONTS.semibold,
  },
});
