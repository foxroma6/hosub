import React, { useState, useEffect, useContext, useRef } from 'react';
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
  Linking,
} from 'react-native';
import apiClient, { API_BASE } from '../api/client';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#4A90D9',
  primaryDark: '#2E75BF',
  background: '#EDF4FB',
  surface: '#FFFFFF',
  text: '#1E3A54',
  textMuted: '#7A9BB5',
  border: '#B8D8F0',
};

function SectionHeader({ title, color }) {
  return (
    <View style={[styles.sectionHeader, { backgroundColor: color }]}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
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
    } catch (error) {
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
    } catch (error) {
      Alert.alert('오류', '채팅을 시작할 수 없습니다. 다시 시도해주세요.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setActionLoading(true);
    try {
      await apiClient.patch(`/fish/${fish_id}`, { status: newStatus });
      setFish((prev) => ({ ...prev, status: newStatus }));
    } catch (error) {
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
          } catch (error) {
            Alert.alert('오류', '삭제에 실패했습니다.');
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleSellerPress = () => {
    if (fish?.seller_id) {
      navigation.navigate('SellerProfile', { user_id: fish.seller_id });
    }
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
  const isOwner = user && fish.seller_id === user.id;
  const isLoggedIn = !!user;

  const statusColors = {
    '판매중': '#22A85A',
    '예약중': '#E8A020',
    '판매완료': '#888888',
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
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
                  const index = Math.round(
                    e.nativeEvent.contentOffset.x / width
                  );
                  setCurrentImageIndex(index);
                }}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: `${API_BASE}${item}` }}
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
              <Text style={styles.carouselPlaceholderLabel}>이미지 없음</Text>
            </View>
          )}
        </View>

        {/* Status & Tags */}
        <View style={styles.tagsRow}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors[fish.status] || '#888' },
            ]}
          >
            <Text style={styles.statusBadgeText}>{fish.status || '판매중'}</Text>
          </View>
          {fish.category && (
            <View style={styles.categoryTag}>
              <Text style={styles.categoryTagText}>{fish.category}</Text>
            </View>
          )}
          {fish.species && (
            <View style={styles.speciesTag}>
              <Text style={styles.speciesTagText}>{fish.species}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{fish.title}</Text>
        </View>

        {/* 상품 정보 */}
        <View style={styles.section}>
          <SectionHeader title="상품 정보" color={COLORS.primary} />
          <View style={styles.sectionBody}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>가격</Text>
              <Text style={styles.priceValue}>
                {fish.price != null
                  ? `${Number(fish.price).toLocaleString()}원`
                  : '가격 문의'}
              </Text>
            </View>
            {fish.weight && <InfoRow label="무게" value={fish.weight} />}
            {fish.quantity && (
              <InfoRow label="수량" value={`${fish.quantity}마리`} />
            )}
          </View>
        </View>

        {/* 판매 정보 */}
        <View style={styles.section}>
          <SectionHeader title="판매 정보" color="#3AADA8" />
          <View style={styles.sectionBody}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>판매자</Text>
              <TouchableOpacity onPress={handleSellerPress}>
                <Text style={[styles.infoValue, styles.sellerLink]}>
                  {fish.seller_username || fish.seller || '-'}
                </Text>
              </TouchableOpacity>
            </View>
            <InfoRow
              label="거래 방식"
              value={fish.trade_type || fish.tradeType}
            />
            <InfoRow label="지역" value={fish.location} />
            <InfoRow label="등록일" value={formatDate(fish.created_at)} />
          </View>
        </View>

        {/* 상품 설명 */}
        <View style={styles.section}>
          <SectionHeader title="상품 설명" color="#8B79D0" />
          <View style={styles.sectionBody}>
            <Text style={styles.descriptionText}>
              {fish.description || '설명이 없습니다.'}
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Action Bar */}
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
                  <Text
                    style={[
                      styles.statusBtnText,
                      fish.status === s && styles.statusBtnTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.deleteButtonText}>삭제</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : isLoggedIn ? (
          <TouchableOpacity
            style={styles.chatButton}
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
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  carouselContainer: {
    width: width,
    height: width * 0.75,
    backgroundColor: '#E0EDF8',
  },
  carouselImage: {
    width: width,
    height: width * 0.75,
  },
  carouselPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselPlaceholderText: {
    fontSize: 60,
    marginBottom: 8,
  },
  carouselPlaceholderLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
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
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: COLORS.surface,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryTagText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  speciesTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  speciesTagText: {
    fontSize: 13,
    color: COLORS.primaryDark,
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 28,
  },
  section: {
    marginTop: 10,
    backgroundColor: COLORS.surface,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionHeaderText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  priceRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  priceLabel: {
    width: 90,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  priceValue: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F6FC',
  },
  infoLabel: {
    width: 90,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  sellerLink: {
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 20,
  },
  actionBar: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 28,
  },
  chatButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  statusBtnTextActive: {
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: '#D63B3B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
