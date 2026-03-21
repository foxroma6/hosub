import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native';
import apiClient, { API_BASE } from '../api/client';
import { COLORS, FONTS } from '../constants/colors';

const CATEGORIES = {
  '담수어': ['구피', '코리·플래코', '디스커스', '베타', '중·대형어', '기타 열대어'],
  '해수어 & 산호': [],
  '수생 무척추동물': ['새우', '가재'],
  '파충류': ['거북이', '개구리'],
  '수초 & 식물': [],
};

const ALL_CATEGORIES = ['전체', ...Object.keys(CATEGORIES)];

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

function getImageUri(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

export default function HomeScreen({ navigation }) {
  const [fish, setFish] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedSpecies, setSelectedSpecies] = useState('');

  const fetchFish = useCallback(async () => {
    try {
      const params = {};
      if (selectedCategory && selectedCategory !== '전체') params.category = selectedCategory;
      if (selectedSpecies) params.species = selectedSpecies;
      if (searchQuery) params.search = searchQuery;
      const response = await apiClient.get('/fish', { params });
      setFish(response.data.fish || response.data || []);
    } catch {
      setFish([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, selectedSpecies, searchQuery]);

  useEffect(() => {
    setLoading(true);
    fetchFish();
  }, [fetchFish]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFish();
  };

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    setSelectedSpecies('');
  };

  const subcategories = selectedCategory !== '전체' ? CATEGORIES[selectedCategory] || [] : [];

  const renderFishItem = ({ item }) => {
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
          {item.species ? (
            <View style={styles.speciesTag}>
              <Text style={styles.speciesTagText}>{item.species}</Text>
            </View>
          ) : null}
          <Text style={styles.itemPrice}>
            {item.price != null ? `${Number(item.price).toLocaleString()}원` : '가격 문의'}
          </Text>
          <Text style={styles.itemMeta}>
            {item.location ? `${item.location} · ` : ''}
            {formatDate(item.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View>
      <View style={styles.header}>
        <Text style={styles.logoText}>AquaPet</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="검색어를 입력해주세요"
          placeholderTextColor={COLORS.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => setSearchQuery(searchText)}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryScrollContent}
      >
        {ALL_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              selectedCategory === cat && styles.categoryChipActive,
            ]}
            onPress={() => handleCategorySelect(cat)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat && styles.categoryChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {subcategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subCategoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {subcategories.map((sub) => (
            <TouchableOpacity
              key={sub}
              style={[
                styles.categoryChip,
                selectedSpecies === sub && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedSpecies(selectedSpecies === sub ? '' : sub)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedSpecies === sub && styles.categoryChipTextActive,
                ]}
              >
                {sub}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderText}>
          {selectedCategory === '전체' ? '전체 상품' : selectedCategory}
          {selectedSpecies ? ` · ${selectedSpecies}` : ''}
        </Text>
        <Text style={styles.listCount}>{fish.length}개</Text>
      </View>
    </View>
  );

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
        data={fish}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderFishItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🐠</Text>
            <Text style={styles.emptyText}>판매 중인 상품이 없습니다</Text>
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
        contentContainerStyle={styles.listContent}
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
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
  },
  logoText: {
    fontSize: 22,
    fontWeight: FONTS.extrabold,
    color: COLORS.primary,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    height: 42,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.text,
  },
  categoryScroll: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  subCategoryScroll: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: FONTS.medium,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: FONTS.semibold,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  listHeaderText: {
    fontSize: 14,
    fontWeight: FONTS.semibold,
    color: COLORS.text,
  },
  listCount: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  listContent: {
    paddingBottom: 24,
    backgroundColor: COLORS.surface,
  },
  listItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    alignItems: 'flex-start',
    gap: 14,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: COLORS.divider,
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 30,
  },
  itemBody: {
    flex: 1,
    paddingTop: 2,
  },
  itemTitle: {
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
    marginBottom: 5,
  },
  speciesTagText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: FONTS.medium,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: FONTS.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: COLORS.textSub,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    backgroundColor: COLORS.surface,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
});
