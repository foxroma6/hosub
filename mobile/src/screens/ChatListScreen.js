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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { API_BASE } from '../api/client';
import { COLORS, FONTS } from '../constants/colors';

function getImageUri(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

function formatTime(dateStr) {
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
}

export default function ChatListScreen({ navigation }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await apiClient.get('/chat');
      setRooms(response.data.rooms || response.data || []);
    } catch {
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

  const handleHideRoom = (item) => {
    const partnerName = item.partner_username || item.partner?.username || '상대방';
    Alert.alert(
      '채팅 삭제',
      `${partnerName}와의 채팅을 삭제하시겠습니까?\n대화 내역은 서버에 유지됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.patch(`/chat/${item.id}/hide`);
              setRooms((prev) => prev.filter((r) => r.id !== item.id));
            } catch {
              Alert.alert('오류', '채팅 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const renderRoom = ({ item }) => {
    const partnerName = item.partner_username || item.partner?.username || '알 수 없음';
    const fishTitle = item.fish_title || item.fish?.title || '상품';
    const rawImage = item.fish_image || item.fish?.images?.[0];
    const fishImage = getImageUri(rawImage);
    const lastMessageTime = item.last_message_at || item.updated_at;

    return (
      <TouchableOpacity
        style={styles.roomItem}
        onPress={() =>
          navigation.navigate('Chat', {
            room_id: item.id,
            fish_title: fishTitle,
            fish_price: item.fish_price || item.fish?.price,
            fish_image: rawImage,
          })
        }
        activeOpacity={0.7}
      >
        {fishImage ? (
          <Image
            source={{ uri: fishImage }}
            style={styles.fishThumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.fishThumbnailPlaceholder}>
            <Text style={styles.fishThumbnailPlaceholderText}>🐠</Text>
          </View>
        )}

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
          {item.last_message ? (
            <Text style={styles.lastMessageText} numberOfLines={1}>
              {item.last_message}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleHideRoom(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>진행 중인 채팅이 없습니다</Text>
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
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 12,
  },
  fishThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: COLORS.divider,
  },
  fishThumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fishThumbnailPlaceholderText: {
    fontSize: 24,
  },
  roomBody: {
    flex: 1,
  },
  roomTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 14,
    fontWeight: FONTS.bold,
    color: COLORS.text,
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textSub,
    marginLeft: 8,
  },
  fishTitleText: {
    fontSize: 13,
    color: COLORS.textSub,
  },
  lastMessageText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
    alignSelf: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
});
