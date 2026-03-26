import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
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
  Modal,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import apiClient, { API_BASE } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { COLORS, FONTS } from '../constants/colors';

const FISH_TYPES = ['담수어', '해수어', '산호', '파충류', '수초 & 식물'];
const GENDERS    = ['수컷', '암컷', '기타'];
const REGIONS    = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
                    '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

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

// 드롭다운 선택 모달
function PickerModal({ visible, title, options, selected, onSelect, onClose, allowClear }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={onClose} />
      <SafeAreaView style={modal.sheet}>
        <View style={modal.header}>
          <Text style={modal.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <ScrollView>
          {allowClear && (
            <TouchableOpacity
              style={[modal.option, !selected && modal.optionActive]}
              onPress={() => { onSelect(''); onClose(); }}
            >
              <Text style={[modal.optionText, !selected && modal.optionTextActive]}>전체</Text>
              {!selected && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          )}
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[modal.option, selected === opt && modal.optionActive]}
              onPress={() => { onSelect(opt); onClose(); }}
            >
              <Text style={[modal.optionText, selected === opt && modal.optionTextActive]}>{opt}</Text>
              {selected === opt && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// 가격 범위 모달
function PriceModal({ visible, priceMin, priceMax, onApply, onClose }) {
  const [min, setMin] = useState(priceMin);
  const [max, setMax] = useState(priceMax);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={onClose} />
      <SafeAreaView style={modal.sheet}>
        <View style={modal.header}>
          <Text style={modal.headerTitle}>가격 범위</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <View style={modal.priceBody}>
          <View style={modal.priceRow}>
            <TextInput
              style={modal.priceInput}
              placeholder="최소 가격"
              placeholderTextColor={COLORS.textMuted}
              value={min}
              onChangeText={setMin}
              keyboardType="numeric"
            />
            <Text style={modal.priceSep}>~</Text>
            <TextInput
              style={modal.priceInput}
              placeholder="최대 가격"
              placeholderTextColor={COLORS.textMuted}
              value={max}
              onChangeText={setMax}
              keyboardType="numeric"
            />
          </View>
          <TouchableOpacity
            style={modal.applyBtn}
            onPress={() => { onApply(min, max); onClose(); }}
          >
            <Text style={modal.applyBtnText}>적용하기</Text>
          </TouchableOpacity>
          {(priceMin || priceMax) && (
            <TouchableOpacity
              style={modal.clearBtn}
              onPress={() => { onApply('', ''); onClose(); }}
            >
              <Text style={modal.clearBtnText}>가격 초기화</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function HomeScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [fish, setFish] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [fishType, setFishType] = useState('');
  const [gender, setGender] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [region, setRegion] = useState('');

  const [sort, setSort] = useState('newest'); // 'newest' | 'popular'
  const [openModal, setOpenModal] = useState(null);
  const [wishlistIds, setWishlistIds] = useState(new Set());

  const fetchWishlistIds = useCallback(async () => {
    if (!user) { setWishlistIds(new Set()); return; }
    try {
      const res = await apiClient.get('/wishlist');
      setWishlistIds(new Set((res.data || []).map((f) => f.id)));
    } catch {
      setWishlistIds(new Set());
    }
  }, [user]);

  const handleToggleWishlist = useCallback(async (fishId) => {
    if (!user) { navigation.navigate('Login'); return; }
    try {
      const res = await apiClient.post(`/wishlist/${fishId}`);
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (res.data.wishlisted) next.add(fishId);
        else next.delete(fishId);
        return next;
      });
    } catch {}
  }, [user]);

  const fetchFish = useCallback(async () => {
    try {
      const params = {};
      if (fishType)    params.fish_type  = fishType;
      if (gender)      params.gender     = gender;
      if (priceMin)    params.price_min  = priceMin;
      if (priceMax)    params.price_max  = priceMax;
      if (region)      params.region     = region;
      if (searchQuery) params.search     = searchQuery;
      params.sort = sort;
      const response = await apiClient.get('/fish', { params });
      setFish(response.data.fish || response.data || []);
    } catch {
      setFish([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fishType, gender, priceMin, priceMax, region, searchQuery, sort]);

  useEffect(() => {
    setLoading(true);
    fetchFish();
  }, [fetchFish]);

  useFocusEffect(
    useCallback(() => {
      fetchWishlistIds();
    }, [fetchWishlistIds])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFish();
  };

  const hasFilter = fishType || gender || priceMin || priceMax || region;

  const resetFilters = () => {
    setFishType('');
    setGender('');
    setPriceMin('');
    setPriceMax('');
    setRegion('');
  };

  const priceLabel = () => {
    if (priceMin && priceMax) return `${Number(priceMin).toLocaleString()}~${Number(priceMax).toLocaleString()}`;
    if (priceMin) return `${Number(priceMin).toLocaleString()}원~`;
    if (priceMax) return `~${Number(priceMax).toLocaleString()}원`;
    return '가격';
  };

  const FilterChip = ({ label, active, onPress }) => (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      <Ionicons
        name="chevron-down"
        size={12}
        color={active ? COLORS.primary : COLORS.textMuted}
        style={{ marginLeft: 3 }}
      />
    </TouchableOpacity>
  );

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
          <View style={styles.tagRow}>
            {item.category ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.category}</Text>
              </View>
            ) : null}
            {item.gender && item.gender !== '기타' ? (
              <View style={[styles.tag, styles.tagGender]}>
                <Text style={styles.tagText}>{item.gender}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.itemPrice}>
            {item.price != null ? `${Number(item.price).toLocaleString()}원` : '가격 문의'}
          </Text>
          {(item.location || formatDate(item.created_at)) ? (
            <Text style={styles.itemMeta}>
              {[item.location, formatDate(item.created_at)].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => handleToggleWishlist(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={wishlistIds.has(item.id) ? 'heart' : 'heart-outline'}
            size={20}
            color={wishlistIds.has(item.id) ? '#EF4444' : COLORS.textMuted}
          />
        </TouchableOpacity>
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

      {/* 필터 칩 바 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        <FilterChip
          label={fishType || '어종'}
          active={!!fishType}
          onPress={() => setOpenModal('fishType')}
        />
        <FilterChip
          label={gender || '성별'}
          active={!!gender}
          onPress={() => setOpenModal('gender')}
        />
        <FilterChip
          label={priceLabel()}
          active={!!(priceMin || priceMax)}
          onPress={() => setOpenModal('price')}
        />
        <FilterChip
          label={region || '지역'}
          active={!!region}
          onPress={() => setOpenModal('region')}
        />
        {hasFilter && (
          <TouchableOpacity style={styles.resetChip} onPress={resetFilters}>
            <Ionicons name="close-circle" size={14} color={COLORS.textMuted} />
            <Text style={styles.resetChipText}>초기화</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderText}>
          {hasFilter ? '필터 적용됨' : '전체 상품'} <Text style={styles.listCount}>{fish.length}개</Text>
        </Text>
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortBtn, sort === 'newest' && styles.sortBtnActive]}
            onPress={() => setSort('newest')}
          >
            <Text style={[styles.sortBtnText, sort === 'newest' && styles.sortBtnTextActive]}>최신순</Text>
          </TouchableOpacity>
          <Text style={styles.sortDivider}>|</Text>
          <TouchableOpacity
            style={[styles.sortBtn, sort === 'popular' && styles.sortBtnActive]}
            onPress={() => setSort('popular')}
          >
            <Text style={[styles.sortBtnText, sort === 'popular' && styles.sortBtnTextActive]}>인기순</Text>
          </TouchableOpacity>
        </View>
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

      <PickerModal
        visible={openModal === 'fishType'}
        title="어종 선택"
        options={FISH_TYPES}
        selected={fishType}
        onSelect={setFishType}
        onClose={() => setOpenModal(null)}
        allowClear
      />
      <PickerModal
        visible={openModal === 'gender'}
        title="성별 선택"
        options={GENDERS}
        selected={gender}
        onSelect={setGender}
        onClose={() => setOpenModal(null)}
        allowClear
      />
      <PickerModal
        visible={openModal === 'region'}
        title="지역 선택"
        options={REGIONS}
        selected={region}
        onSelect={setRegion}
        onClose={() => setOpenModal(null)}
        allowClear
      />
      <PriceModal
        visible={openModal === 'price'}
        priceMin={priceMin}
        priceMax={priceMax}
        onApply={(min, max) => { setPriceMin(min); setPriceMax(max); }}
        onClose={() => setOpenModal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: COLORS.surface },
  logoText: { fontSize: 22, fontWeight: FONTS.extrabold, color: COLORS.primary },
  searchContainer: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  searchInput: {
    height: 42, backgroundColor: COLORS.background,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, fontSize: 14, color: COLORS.text,
  },
  filterBar: { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, marginRight: 6,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  filterChipText: { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  filterChipTextActive: { color: COLORS.primary, fontWeight: FONTS.semibold },
  resetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  resetChipText: { fontSize: 12, color: COLORS.textMuted },
  listHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.background,
  },
  listHeaderText: { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  listCount: { fontSize: 13, color: COLORS.textMuted, fontWeight: FONTS.regular },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sortBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  sortBtnActive: {},
  sortBtnText: { fontSize: 13, color: COLORS.textMuted },
  sortBtnTextActive: { color: COLORS.primary, fontWeight: FONTS.semibold },
  sortDivider: { fontSize: 11, color: COLORS.border },
  listContent: { paddingBottom: 24, backgroundColor: COLORS.surface },
  listItem: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
    alignItems: 'flex-start', gap: 14,
  },
  thumbnail: { width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.divider },
  thumbnailPlaceholder: {
    width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.divider,
    justifyContent: 'center', alignItems: 'center',
  },
  thumbnailPlaceholderText: { fontSize: 30 },
  heartBtn: { padding: 4, alignSelf: 'flex-end', marginBottom: 2 },
  itemBody: { flex: 1, paddingTop: 2 },
  itemTitle: { fontSize: 15, fontWeight: FONTS.semibold, color: COLORS.text, lineHeight: 21, marginBottom: 5 },
  tagRow: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  tag: {
    alignSelf: 'flex-start', backgroundColor: COLORS.primary,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
  },
  tagGender: { backgroundColor: '#8B79D0' },
  tagText: { fontSize: 11, color: '#FFFFFF', fontWeight: FONTS.medium },
  itemPrice: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  itemMeta: { fontSize: 12, color: COLORS.textSub },
  emptyContainer: { alignItems: 'center', paddingTop: 80, backgroundColor: COLORS.surface },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontSize: 15, color: COLORS.textMuted },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  headerTitle: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  optionActive: { backgroundColor: COLORS.primaryLight },
  optionText: { fontSize: 15, color: COLORS.text },
  optionTextActive: { color: COLORS.primary, fontWeight: FONTS.semibold },
  priceBody: { padding: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  priceInput: {
    flex: 1, height: 48, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: COLORS.text,
  },
  priceSep: { fontSize: 16, color: COLORS.textMuted },
  applyBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    height: 48, justifyContent: 'center', alignItems: 'center',
  },
  applyBtnText: { color: '#FFF', fontSize: 16, fontWeight: FONTS.bold },
  clearBtn: { marginTop: 12, alignItems: 'center' },
  clearBtnText: { color: COLORS.textMuted, fontSize: 14, textDecorationLine: 'underline' },
});
