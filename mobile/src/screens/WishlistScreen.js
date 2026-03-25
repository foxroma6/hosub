import React, { useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { API_BASE } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { COLORS, FONTS } from '../constants/colors';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getImageUri(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

export default function WishlistScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [fish, setFish] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWishlist = useCallback(async () => {
    try {
      const response = await apiClient.get('/wishlist');
      setFish(response.data || []);
    } catch {
      setFish([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setLoading(true);
        fetchWishlist();
      }
    }, [user, fetchWishlist])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchWishlist();
  };

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="heart-outline" size={56} color={COLORS.textMuted} />
        <Text style={styles.emptyTitle}>로그인이 필요합니다</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginBtnText}>로그인하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const renderItem = ({ item }) => {
    const rawImage = item.images?.length > 0 ? item.images[0] : item.image_url || null;
    const imageUri = getImageUri(rawImage);
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => navigation.navigate('FishDetail', { fish_id: item.id })}
        activeOpacity={0.7}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.thumbnailPlaceholderText}>🐠</Text>
          </View>
        )}
        <View style={styles.itemBody}>
          <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
          {item.category ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.category}</Text>
            </View>
          ) : null}
          <Text style={styles.itemPrice}>
            {item.price != null ? `${Number(item.price).toLocaleString()}원` : '가격 문의'}
          </Text>
          {(item.location || formatDate(item.created_at)) ? (
            <Text style={styles.itemMeta}>
              {[item.location, formatDate(item.created_at)].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <Ionicons name="heart" size={20} color="#EF4444" style={styles.heartIcon} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>찜 목록</Text>
        <Text style={styles.headerCount}>{fish.length}개</Text>
      </View>
      <FlatList
        data={fish}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Ionicons name="heart-outline" size={56} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>찜한 상품이 없습니다</Text>
            <Text style={styles.emptyDesc}>마음에 드는 상품에 하트를 눌러보세요</Text>
          </View>
        }
        contentContainerStyle={fish.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: FONTS.extrabold, color: COLORS.text },
  headerCount: { fontSize: 14, color: COLORS.textMuted },
  listItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    alignItems: 'center',
    gap: 14,
  },
  thumbnail: { width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.divider },
  thumbnailPlaceholder: {
    width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.divider,
    justifyContent: 'center', alignItems: 'center',
  },
  thumbnailPlaceholderText: { fontSize: 30 },
  itemBody: { flex: 1, paddingTop: 2 },
  itemTitle: { fontSize: 15, fontWeight: FONTS.semibold, color: COLORS.text, lineHeight: 21, marginBottom: 4 },
  tag: {
    alignSelf: 'flex-start', backgroundColor: COLORS.primary,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 5,
  },
  tagText: { fontSize: 11, color: '#FFFFFF', fontWeight: FONTS.medium },
  itemPrice: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  itemMeta: { fontSize: 12, color: COLORS.textSub },
  heartIcon: { marginLeft: 4 },
  emptyTitle: { fontSize: 16, fontWeight: FONTS.semibold, color: COLORS.text, marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: COLORS.textMuted },
  loginBtn: {
    marginTop: 20, backgroundColor: COLORS.primary,
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12,
  },
  loginBtnText: { color: '#FFF', fontSize: 15, fontWeight: FONTS.bold },
});
