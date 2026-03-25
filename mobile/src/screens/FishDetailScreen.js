import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import apiClient, { API_BASE } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { COLORS, FONTS } from '../constants/colors';

const { width } = Dimensions.get('window');

function getImageUri(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function FishDetailScreen({ route, navigation }) {
  const { fish_id } = route.params;
  const { user } = useContext(AuthContext);

  const [fish, setFish] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    fetchFish();
  }, [fish_id]);

  const fetchFish = async () => {
    try {
      const response = await apiClient.get(`/fish/${fish_id}`);
      setFish(response.data);
    } catch {
      Alert.alert('오류', '상품 정보를 불러오지 못했습니다.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async () => {
    setActionLoading(true);
    try {
      const response = await apiClient.post(`/chat/start/${fish_id}`);
      const roomId = response.data.room_id || response.data.id;
      navigation.navigate('Chat', {
        room_id: roomId,
        fish_title: fish?.title,
        fish_price: fish?.price,
        fish_image: fish?.images?.[0],
      });
    } catch {
      Alert.alert('오류', '채팅을 시작할 수 없습니다. 다시 시도해주세요.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setActionLoading(true);
    try {
      await apiClient.patch(`/fish/${fish_id}/status`, { status: newStatus });
      setFish((prev) => ({ ...prev, status: newStatus }));
    } catch {
      Alert.alert('오류', '상태 변경에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('삭제 확인', '정말로 이 상품을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await apiClient.delete(`/fish/${fish_id}`);
            Alert.alert('완료', '상품이 삭제되었습니다.', [
              { text: '확인', onPress: () => navigation.goBack() },
            ]);
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!fish) return null;

  const images = fish.images || [];
  const isOwner = user && fish.seller?.id === user.id;
  const isLoggedIn = !!user;

  const statusColor = {
    '판매중': COLORS.badge.active,
    '예약중': COLORS.badge.reserved,
    '판매완료': COLORS.badge.done,
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        <View style={styles.carouselContainer}>
          {images.length > 0 ? (
            <>
              <FlatList
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => String(index)}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / width);
                  setCurrentImageIndex(index);
                }}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: getImageUri(item) }}
                    style={styles.carouselImage}
                    resizeMode="cover"
                  />
                )}
              />
              {images.length > 1 && (
                <View style={styles.dotsContainer}>
                  {images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dot,
                        currentImageIndex === index && styles.dotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.carouselPlaceholder}>
              <Text style={styles.carouselPlaceholderText}>🐠</Text>
            </View>
          )}
        </View>

        {/* Seller Row */}
        <TouchableOpacity
          style={styles.sellerRow}
          onPress={() => {
            if (fish?.seller?.id) {
              navigation.navigate('SellerProfile', { user_id: fish.seller.id });
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.sellerAvatar}>
            <Text style={styles.sellerAvatarText}>
              {(fish.seller?.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.sellerUsername}>{fish.seller?.username || '알 수 없음'}</Text>
          <Text style={styles.sellerViewMore}>판매자 정보 보기 ›</Text>
        </TouchableOpacity>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor[fish.status] || COLORS.badge.done }]}>
              <Text style={styles.statusBadgeText}>{fish.status || '판매중'}</Text>
            </View>
            {fish.category && (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{fish.category}</Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{fish.title}</Text>
          <Text style={styles.price}>
            {fish.price != null ? `${Number(fish.price).toLocaleString()}원` : '가격 문의'}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.sectionDivider} />

        {/* 상품 정보 */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>상품 정보</Text>
          <InfoRow label="성별" value={fish.gender && fish.gender !== '미구분' ? fish.gender : null} />
          <InfoRow label="크기" value={fish.weight} />
          <InfoRow label="수량" value={fish.quantity ? `${fish.quantity}마리` : null} />
          <InfoRow label="판매방법" value={fish.trade_type || fish.tradeType} />
          <InfoRow label="거래지역" value={fish.location} />
          <InfoRow label="등록일" value={fish.created_at} />
        </View>

        {/* Divider */}
        <View style={styles.sectionDivider} />

        {/* 상품 설명 */}
        <View style={styles.descSection}>
          <Text style={styles.sectionTitle}>상품 설명</Text>
          <Text style={styles.descriptionText}>
            {fish.description || '설명이 없습니다.'}
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.actionBar}>
        {isOwner ? (
          <View style={styles.ownerActions}>
            <View style={styles.statusButtons}>
              {['판매중', '예약중', '판매완료'].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusBtn,
                    fish.status === s && styles.statusBtnActive,
                  ]}
                  onPress={() => handleStatusChange(s)}
                  disabled={actionLoading || fish.status === s}
                >
                  <Text style={[styles.statusBtnText, fish.status === s && styles.statusBtnTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={actionLoading}>
              {actionLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.deleteButtonText}>삭제</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : isLoggedIn ? (
          <TouchableOpacity
            style={[styles.chatButton, fish.status === '판매완료' && styles.chatButtonDisabled]}
            onPress={handleStartChat}
            disabled={actionLoading || fish.status === '판매완료'}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.chatButtonText}>
                {fish.status === '판매완료' ? '판매 완료된 상품입니다' : '채팅 문의하기'}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.chatButtonText}>로그인 후 문의하기</Text>
          </TouchableOpacity>
        )}
      </View>
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
  carouselContainer: {
    width: width,
    height: 320,
    backgroundColor: COLORS.divider,
  },
  carouselImage: {
    width: width,
    height: 320,
  },
  carouselPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselPlaceholderText: {
    fontSize: 64,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 14,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 10,
  },
  sellerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: FONTS.bold,
  },
  sellerUsername: {
    flex: 1,
    fontSize: 14,
    fontWeight: FONTS.semibold,
    color: COLORS.text,
  },
  sellerViewMore: {
    fontSize: 12,
    color: COLORS.textSub,
  },
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: FONTS.semibold,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  categoryChipText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: FONTS.medium,
  },
  title: {
    fontSize: 20,
    fontWeight: FONTS.bold,
    color: COLORS.text,
    lineHeight: 28,
    marginTop: 8,
  },
  price: {
    fontSize: 24,
    fontWeight: FONTS.extrabold,
    color: COLORS.primary,
    marginTop: 6,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: COLORS.divider,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: FONTS.semibold,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  infoLabel: {
    width: 80,
    fontSize: 14,
    color: COLORS.textSub,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: FONTS.medium,
  },
  descSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 100,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
  },
  chatButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButtonDisabled: {
    backgroundColor: COLORS.badge.done,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: FONTS.bold,
  },
  ownerActions: {
    gap: 10,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  statusBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusBtnText: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: FONTS.semibold,
  },
  statusBtnTextActive: {
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: FONTS.bold,
  },
});
