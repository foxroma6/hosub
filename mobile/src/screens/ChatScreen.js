import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import apiClient, { API_BASE } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { COLORS, FONTS } from '../constants/colors';

function getImageUri(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? '오후' : '오전';
  const displayHours = hours > 12 ? hours - 12 : hours || 12;
  return `${period} ${displayHours}:${minutes}`;
}

export default function ChatScreen({ route, navigation }) {
  const { room_id, fish_title, fish_price, fish_image } = route.params;
  const { user } = useContext(AuthContext);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const pollingRef = useRef(null);

  const fetchMessages = useCallback(async (isInitial = false) => {
    try {
      const response = await apiClient.get(`/chat/${room_id}/messages`);
      const newMessages = response.data.messages || response.data || [];
      setMessages(newMessages);
      if (isInitial) setLoading(false);
    } catch {
      if (isInitial) setLoading(false);
    }
  }, [room_id]);

  useEffect(() => {
    fetchMessages(true);
    pollingRef.current = setInterval(() => {
      fetchMessages(false);
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!messageText.trim()) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      await apiClient.post(`/chat/${room_id}/send`, { message: text });
      await fetchMessages(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    } catch {
      Alert.alert('오류', '메시지 전송에 실패했습니다.');
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  const fishImageUri = getImageUri(fish_image);

  const renderMessage = ({ item, index }) => {
    const isMine = item.sender_id === user?.id || item.is_mine;
    const prevItem = messages[index - 1];
    const showSender =
      !isMine &&
      (!prevItem || prevItem.sender_id !== item.sender_id || prevItem.is_mine);

    return (
      <View style={[styles.bubbleWrapper, isMine ? styles.myBubbleWrapper : styles.theirBubbleWrapper]}>
        {!isMine && showSender && (
          <View style={styles.senderAvatar}>
            <Text style={styles.senderAvatarText}>
              {(item.sender_username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {!isMine && !showSender && <View style={styles.avatarSpacer} />}

        <View style={styles.bubbleContainer}>
          {!isMine && showSender && (
            <Text style={styles.senderName}>{item.sender_username || '상대방'}</Text>
          )}
          <View style={styles.bubbleRow}>
            {isMine && (
              <Text style={styles.myTimeText}>
                {formatTime(item.created_at || item.timestamp)}
              </Text>
            )}
            <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
              <Text style={isMine ? styles.myBubbleText : styles.theirBubbleText}>
                {item.message || item.content}
              </Text>
            </View>
            {!isMine && (
              <Text style={styles.theirTimeText}>
                {formatTime(item.created_at || item.timestamp)}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.fishHeader}>
        {fishImageUri ? (
          <Image source={{ uri: fishImageUri }} style={styles.fishHeaderImage} resizeMode="cover" />
        ) : (
          <View style={styles.fishHeaderImagePlaceholder}>
            <Text style={styles.fishHeaderPlaceholderText}>🐠</Text>
          </View>
        )}
        <View style={styles.fishHeaderInfo}>
          <Text style={styles.fishHeaderTitle} numberOfLines={1}>
            {fish_title || '상품'}
          </Text>
          {fish_price != null && (
            <Text style={styles.fishHeaderPrice}>
              {Number(fish_price).toLocaleString()}원
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => String(item.id || index)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyMessagesText}>첫 메시지를 보내보세요! 👋</Text>
            </View>
          }
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="메시지를 입력하세요..."
            placeholderTextColor={COLORS.textMuted}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>전송</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fishHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  fishHeaderImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.divider,
  },
  fishHeaderImagePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fishHeaderPlaceholderText: {
    fontSize: 16,
  },
  fishHeaderInfo: {
    flex: 1,
  },
  fishHeaderTitle: {
    fontSize: 14,
    fontWeight: FONTS.semibold,
    color: COLORS.text,
  },
  fishHeaderPrice: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: FONTS.bold,
    marginTop: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    marginVertical: 3,
    alignItems: 'flex-end',
  },
  myBubbleWrapper: {
    justifyContent: 'flex-end',
  },
  theirBubbleWrapper: {
    justifyContent: 'flex-start',
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 2,
  },
  senderAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: FONTS.bold,
  },
  avatarSpacer: {
    width: 38,
  },
  bubbleContainer: {
    maxWidth: '70%',
  },
  senderName: {
    fontSize: 11,
    color: COLORS.textSub,
    marginBottom: 3,
    marginLeft: 2,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: '100%',
  },
  myBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: COLORS.divider,
    borderBottomLeftRadius: 4,
  },
  myBubbleText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  theirBubbleText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  myTimeText: {
    fontSize: 11,
    color: COLORS.textSub,
    marginBottom: 2,
    textAlign: 'right',
  },
  theirTimeText: {
    fontSize: 11,
    color: COLORS.textSub,
    marginBottom: 2,
    textAlign: 'left',
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyMessagesText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: FONTS.bold,
    fontSize: 14,
  },
});
