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
  ScrollView,
} from 'react-native';
import apiClient, { API_BASE } from '../api/client';
import { AuthContext } from '../context/AuthContext';

const COLORS = {
  primary: '#4A90D9',
  primaryDark: '#2E75BF',
  background: '#EDF4FB',
  surface: '#FFFFFF',
  text: '#1E3A54',
  textMuted: '#7A9BB5',
  border: '#B8D8F0',
};

function AvatarCircle({ name, size = 64 }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <View
      style={[
        styles.avatarCircle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {initial}
      </Text>
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

  const fetchData = useCallback(async () => {
    try {
      const [meResponse, listingsResponse] = await Promise.all([
        apiClient.get('/me'),
        apiClient.get('/me/listings'),
      ]);
      const userData = meResponse.data;
      setProfile(userData);
      setBio(userData.bio || '');
      setListings(listingsResponse.data.listings || listingsResponse.data || []);
    } catch (error) {
      Alert.alert('오류', '프로필 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      Alert.alert('완료', '자기소개가 저장되었습니다.');
    } catch (error) {
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
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const statusColors = {
    '판매중': '#22A85A',
    '예약중': '#E8A020',
    '판매완료': '#888888',
  };

  const renderListing = ({ item }) => {
    const imageUri =
      item.images && item.images.length > 0
        ? `${API_BASE}${item.images[0]}`
        : null;

    return (
      <TouchableOpacity
        style={styles.listingItem}
        onPress={() => navigation.navigate('FishDetail', { fish_id: item.id })}
        activeOpacity={0.8}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.listingImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.listingImagePlaceholder}>
            <Text style={{ fontSize: 20 }}>🐠</Text>
          </View>
        )}
        <View style={styles.listingBody}>
          <Text style={styles.listingTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.listingPrice}>
            {item.price != null
              ? `${Number(item.price).toLocaleString()}원`
              : '가격 문의'}
          </Text>
          <View style={styles.listingMeta}>
            {item.status && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColors[item.status] || '#888' },
                ]}
              >
                <Text style={styles.statusBadgeText}>{item.status}</Text>
              </View>
            )}
            {item.species && (
              <Text style={styles.speciesText}>{item.species}</Text>
            )}
          </View>
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
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>MY</Text>
              <TouchableOpacity onPress={handleLogout}>
                <Text style={styles.logoutText}>로그아웃</Text>
              </TouchableOpacity>
            </View>

            {/* Profile Card */}
            <View style={styles.profileCard}>
              <AvatarCircle name={profile?.username || authUser?.username} size={72} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileUsername}>
                  {profile?.username || authUser?.username || '-'}
                </Text>
                <Text style={styles.profileEmail}>
                  {profile?.email || authUser?.email || '-'}
                </Text>
              </View>
            </View>

            {/* Bio Section */}
            <View style={styles.bioSection}>
              <View style={styles.bioHeader}>
                <Text style={styles.bioTitle}>자기소개</Text>
                <TouchableOpacity
                  onPress={() => setEditingBio(!editingBio)}
                >
                  <Text style={styles.editBioButton}>
                    {editingBio ? '취소' : '수정'}
                  </Text>
                </TouchableOpacity>
              </View>
              {editingBio ? (
                <View style={styles.bioEditContainer}>
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
                <Text style={styles.bioText}>
                  {profile?.bio || '자기소개가 없습니다. 수정 버튼을 눌러 추가해보세요.'}
                </Text>
              )}
            </View>

            {/* View Profile Button */}
            <TouchableOpacity
              style={styles.viewProfileButton}
              onPress={() =>
                navigation.navigate('SellerProfile', {
                  user_id: profile?.id || authUser?.id,
                })
              }
            >
              <Text style={styles.viewProfileButtonText}>
                내 프로필 보기 →
              </Text>
            </TouchableOpacity>

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
        showsVerticalScrollIndicator={false}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  logoutText: {
    fontSize: 14,
    color: '#D63B3B',
    fontWeight: '600',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 16,
  },
  avatarCircle: {
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileUsername: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  bioSection: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 12,
  },
  bioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bioTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  editBioButton: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  bioText: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
  },
  bioEditContainer: {
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
    minHeight: 80,
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
    fontWeight: '700',
    fontSize: 14,
  },
  viewProfileButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  viewProfileButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  listingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  listingsHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  listingsCount: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  listingItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
    alignItems: 'center',
  },
  listingImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  listingImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listingBody: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginBottom: 5,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  speciesText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  addListingButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  addListingButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
