import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../api/client';
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

const CATEGORIES = {
  '담수어': ['구피', '코리·플래코', '디스커스', '베타', '중·대형어', '기타 열대어'],
  '해수어 & 산호': [],
  '수생 무척추동물': ['새우', '가재'],
  '파충류': ['거북이', '개구리'],
  '수초 & 식물': [],
};

const TRADE_TYPES = ['직거래', '택배', '직거래 · 택배 모두 가능'];

function SelectorRow({ label, options, selected, onSelect }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.selectorRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.selectorChip,
              selected === opt && styles.selectorChipActive,
            ]}
            onPress={() => onSelect(opt)}
          >
            <Text
              style={[
                styles.selectorChipText,
                selected === opt && styles.selectorChipTextActive,
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function NewFishScreen({ navigation }) {
  const { token } = useContext(AuthContext);

  const [images, setImages] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [species, setSpecies] = useState('');
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [quantity, setQuantity] = useState('');
  const [tradeType, setTradeType] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      const newImages = result.assets.slice(0, 5 - images.length);
      setImages((prev) => [...prev, ...newImages]);
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCategorySelect = (cat) => {
    setCategory(cat);
    setSpecies('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    if (!category) {
      setError('카테고리를 선택해주세요.');
      return;
    }
    if (!price) {
      setError('가격을 입력해주세요.');
      return;
    }
    if (!tradeType) {
      setError('거래 방식을 선택해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      if (species) formData.append('species', species);
      formData.append('price', price);
      if (weight) formData.append('weight', weight);
      if (quantity) formData.append('quantity', quantity);
      formData.append('trade_type', tradeType);
      if (location) formData.append('location', location.trim());
      if (description) formData.append('description', description.trim());

      images.forEach((img, index) => {
        const filename = img.uri.split('/').pop();
        const ext = filename.split('.').pop().toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        formData.append('images', {
          uri: img.uri,
          name: filename || `image_${index}.jpg`,
          type: mimeType,
        });
      });

      await apiClient.post('/fish', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('완료', '상품이 등록되었습니다!', [
        {
          text: '확인',
          onPress: () => {
            setTitle('');
            setCategory('');
            setSpecies('');
            setPrice('');
            setWeight('');
            setQuantity('');
            setTradeType('');
            setLocation('');
            setDescription('');
            setImages([]);
            navigation.navigate('Home');
          },
        },
      ]);
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        '등록에 실패했습니다. 다시 시도해주세요.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const subcategories = category ? CATEGORIES[category] || [] : [];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>상품 등록</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Image Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            사진 ({images.length}/5)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.imageRow}>
              {images.map((img, index) => (
                <View key={index} style={styles.imageThumbnailContainer}>
                  <Image
                    source={{ uri: img.uri }}
                    style={styles.imageThumbnail}
                  />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => removeImage(index)}
                  >
                    <Text style={styles.removeImageBtnText}>×</Text>
                  </TouchableOpacity>
                  {index === 0 && (
                    <View style={styles.mainImageBadge}>
                      <Text style={styles.mainImageBadgeText}>대표</Text>
                    </View>
                  )}
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity
                  style={styles.addImageBtn}
                  onPress={pickImages}
                >
                  <Text style={styles.addImageBtnIcon}>+</Text>
                  <Text style={styles.addImageBtnText}>사진 추가</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>제목 *</Text>
          <TextInput
            style={styles.input}
            placeholder="상품 제목"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
          />
        </View>

        {/* Category */}
        <SelectorRow
          label="카테고리 *"
          options={Object.keys(CATEGORIES)}
          selected={category}
          onSelect={handleCategorySelect}
        />

        {/* Species */}
        {subcategories.length > 0 && (
          <SelectorRow
            label="어종"
            options={subcategories}
            selected={species}
            onSelect={(sp) => setSpecies(species === sp ? '' : sp)}
          />
        )}

        {/* Price */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>가격 (원) *</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 5000"
            placeholderTextColor={COLORS.textMuted}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        {/* Weight */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>무게</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 10g"
            placeholderTextColor={COLORS.textMuted}
            value={weight}
            onChangeText={setWeight}
            returnKeyType="next"
          />
        </View>

        {/* Quantity */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>수량 (마리)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 5"
            placeholderTextColor={COLORS.textMuted}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        {/* Trade Type */}
        <SelectorRow
          label="거래 방식 *"
          options={TRADE_TYPES}
          selected={tradeType}
          onSelect={setTradeType}
        />

        {/* Location */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>거래 지역</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 서울 강남구"
            placeholderTextColor={COLORS.textMuted}
            value={location}
            onChangeText={setLocation}
            returnKeyType="next"
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>상품 설명</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="상품에 대한 자세한 설명을 작성해주세요"
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>등록하기</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FFEAEA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFB8B8',
  },
  errorText: {
    color: '#D63B3B',
    fontSize: 13,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  imageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  imageThumbnailContainer: {
    position: 'relative',
    width: 90,
    height: 90,
  },
  imageThumbnail: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: COLORS.border,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D63B3B',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  removeImageBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  mainImageBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  mainImageBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  addImageBtn: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageBtnIcon: {
    fontSize: 24,
    color: COLORS.textMuted,
    lineHeight: 28,
  },
  addImageBtnText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectorChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  selectorChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectorChipText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  selectorChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 40,
  },
});
