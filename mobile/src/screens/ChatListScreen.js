import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import apiClient, { API_BASE } from '../api/client';

const COLORS = {
  primary: '#4A90D9',
  primaryDark: '#2E75BF',
  background: '#EDF4FB',
  surface: '#FFFFFF',
  text: '#1E3A54',
  textMuted: '#7A9BB5',
  border: '#B8D8F0',
};

function AvatarCircle({ name, size = 44 }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <View
      style={[
        styles.avatarCircle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
        {initial}
      </Text>
    </View>
  );
}

export default function ChatListScreen({ navigation }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await apiClient.get('/chat');
      setRooms(response.data.rooms || response.data || []);
    } catch (error) {
      setRooms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRooms();
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const period = hours >= 12 ? '오후' : '오전';
      const displayHours = hours > 12 ? hours - 12 : hours || 12;
      return `${period} ${displayHours}:${minutes}`;
    } else if (diffDays === 1) {
      return '어제';
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  const renderRoom = ({ item }) => {
    const partnerName =
      item.partner_username || item.partner?.username || '알 수 없음';
    const fishTitle = item.fish_title || item.fish?.title || '상품';
    const fishImage = item.fish_image || item.fish?.images?.[0];
    const lastMessage = item.last_message || '대화를 시작해보세요';
    const lastMessageTime = item.last_message_at || item.updated_at;
    const unreadCount = item.unread_count || 0;

    return (
      <TouchableOpacity
        style={styles.roomItem}
        onPress={() =>
          navigation.navigate('Chat', {
            room_id: item.id,
            fish_title: fishTitle,
            fish_price: item.fish_price || item.fish?.price,
            fish_image: fishImage,
          })
        }
        activeOpacity={0.75}
      >
        <View style={styles.roomLeft}>
          {fishImage ? (
            <Image
              source={{ uri: `${API_BASE}${fishImage}` }}
              style={styles.fishThumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.fishThumbnailPlaceholder}>
              <Text style={styles.fishThumbnailPlaceholderText}>🐠</Text>
            </View>
          )}
          <AvatarCircle name={partnerName} size={40} />
        </View>

        <View style={styles.roomBody}>
          <View style={styles.roomTopRow}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {partnerName}
            </Text>
            <Text style={styles.timeText}>{formatTime(lastMessageTime)}</Text>
          </View>
          <Text style={styles.fishTitleText} numberOfLines={1}>
            {fishTitle}
          </Text>
          <View style={styles.lastMsgRow}>
            <Text style={styles.lastMessageText} numberOfLines={1}>
              {lastMessage}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>채팅</Text>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRoom}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>채팅 내역이 없습니다</Text>
            <Text style={styles.emptySubText}>
              상품을 둘러보고 판매자에게 문의해보세요
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
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
  roomItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 12,
  },
  roomLeft: {
    position: 'relative',
    width: 56,
    height: 56,
  },
  fishThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fishThumbnailPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fishThumbnailPlaceholderText: {
    fontSize: 22,
  },
  avatarCircle: {
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  roomBody: {
    flex: 1,
  },
  roomTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  partnerName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 8,
  },
  fishTitleText: {
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 3,
  },
  lastMsgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessageText: {
    fontSize: 13,
    color: COLORS.textMuted,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 84,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
