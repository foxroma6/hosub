import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import apiClient, { API_BASE } from '../api/client';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 36) / 2;

const COLORS = {
  primary: '#4A90D9',
  primaryDark: '#2E75BF',
  background: '#EDF4FB',
  surface: '#FFFFFF',
  text: '#1E3A54',
  textMuted: '#7A9BB5',
  border: '#B8D8F0',
};

const CATEGORIES = {
  '담수어': ['구피', '코리·플래코', '디스커스', '베타', '중·대형어', '기타 열대어'],
  '해수어 & 산호': [],
  '수생 무척추동물': ['새우', '가재'],
  '파충류': ['거북이', '개구리'],
  '수초 & 식물': [],
};

const ALL_CATEGORIES = ['전체', ...Object.keys(CATEGORIES)];

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
      if (selectedCategory && selectedCategory !== '전체') {
        params.category = selectedCategory;
      }
      if (selectedSpecies) {
        params.species = selectedSpecies;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      const response = await apiClient.get('/fish', { params });
      setFish(response.data.fish || response.data || []);
    } catch (error) {
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

  const handleSearch = () => {
    setSearchQuery(searchText);
  };

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    setSelectedSpecies('');
  };

  const handleSpeciesSelect = (sp) => {
    setSelectedSpecies(selectedSpecies === sp ? '' : sp);
  };

  const subcategories =
    selectedCategory !== '전체' ? CATEGORIES[selectedCategory] || [] : [];

  const renderFishCard = ({ item }) => {
    const imageUri =
      item.images && item.images.length > 0
        ? `${API_BASE}${item.images[0]}`
        : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('FishDetail', { fish_id: item.id })}
        activeOpacity={0.8}
      >
        <View style={styles.cardImageContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Text style={styles.cardImagePlaceholderText}>🐠</Text>
            </View>
          )}
          {item.status && item.status !== '판매중' && (
            <View style={[
              styles.statusBadge,
              item.status === '판매완료' ? styles.statusSold : styles.statusReserved,
            ]}>
              <Text style={styles.statusBadgeText}>{item.status}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          {item.species ? (
            <View style={styles.speciesTag}>
              <Text style={styles.speciesTagText}>{item.species}</Text>
            </View>
          ) : null}
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.cardPrice}>
            {item.price != null
              ? `${Number(item.price).toLocaleString()}원`
              : '가격 문의'}
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

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="어종, 상품명으로 검색..."
          placeholderTextColor={COLORS.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>검색</Text>
        </TouchableOpacity>
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
              styles.chip,
              selectedCategory === cat && styles.chipSelected,
            ]}
            onPress={() => handleCategorySelect(cat)}
          >
            <Text
              style={[
                styles.chipText,
                selectedCategory === cat && styles.chipTextSelected,
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
          style={styles.subcategoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {subcategories.map((sp) => (
            <TouchableOpacity
              key={sp}
              style={[
                styles.subchip,
                selectedSpecies === sp && styles.subchipSelected,
              ]}
              onPress={() => handleSpeciesSelect(sp)}
            >
              <Text
                style={[
                  styles.subchipText,
                  selectedSpecies === sp && styles.subchipTextSelected,
                ]}
              >
                {sp}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.listHeader}>
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
        renderItem={renderFishCard}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>🐟</Text>
            <Text style={styles.emptySubText}>등록된 상품이 없습니다</Text>
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
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  categoryScroll: {
    backgroundColor: COLORS.surface,
  },
  categoryScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  subcategoryScroll: {
    backgroundColor: '#F5FAFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  subchip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  subchipSelected: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  subchipText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  subchipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  listCount: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  listContent: {
    paddingBottom: 20,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImageContainer: {
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 0.8,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: CARD_WIDTH * 0.8,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImagePlaceholderText: {
    fontSize: 36,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusSold: {
    backgroundColor: '#666',
  },
  statusReserved: {
    backgroundColor: '#E8A020',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    padding: 10,
  },
  speciesTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F4FF',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 5,
  },
  speciesTagText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 5,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptySubText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
});
