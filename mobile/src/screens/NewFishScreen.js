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
import { COLORS, FONTS } from '../constants/colors';

const FISH_TYPES = ['담수어', '해수어', '산호', '파충류', '수초 & 식물'];
const GENDERS    = ['수컷', '암컷', '기타'];
const TRADE_TYPES = ['직거래', '택배', '모두 가능'];

export default function NewFishScreen({ navigation }) {
  const { token } = useContext(AuthContext);

  const [images, setImages] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [species, setSpecies] = useState('');
  const [gender, setGender] = useState('기타');
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [quantity, setQuantity] = useState('');
  const [tradeType, setTradeType] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [titleFocused, setTitleFocused] = useState(false);
  const [priceFocused, setPriceFocused] = useState(false);
  const [weightFocused, setWeightFocused] = useState(false);
  const [quantityFocused, setQuantityFocused] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

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
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!category) { setError('카테고리를 선택해주세요.'); return; }
    if (!price) { setError('가격을 입력해주세요.'); return; }
    if (!tradeType) { setError('거래 방식을 선택해주세요.'); return; }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('gender', gender);
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
            setGender('기타');
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

        {/* Image Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>사진 ({images.length}/5)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.imageRow}>
              {images.map((img, index) => (
                <View key={index} style={styles.imageThumbnailContainer}>
                  <Image source={{ uri: img.uri }} style={styles.imageThumbnail} />
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
                <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
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
            style={[styles.input, titleFocused && styles.inputFocused]}
            placeholder="상품 제목"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
          />
        </View>

        {/* Fish Type */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>어종 *</Text>
          <View style={styles.pillRow}>
            {FISH_TYPES.map((ft) => (
              <TouchableOpacity
                key={ft}
                style={[styles.pill, category === ft && styles.pillActive]}
                onPress={() => handleCategorySelect(ft)}
              >
                <Text style={[styles.pillText, category === ft && styles.pillTextActive]}>
                  {ft}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Gender */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>성별</Text>
          <View style={styles.pillRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.pill, gender === g && styles.pillActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.pillText, gender === g && styles.pillTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Species (free text) */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>세부 어종 <Text style={{ color: COLORS.textMuted, fontWeight: '400' }}>(선택)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="예) 구피, 베타, 네온테트라"
            placeholderTextColor={COLORS.textMuted}
            value={species}
            onChangeText={setSpecies}
            returnKeyType="next"
          />
        </View>

        {/* Price */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>가격 (원) *</Text>
          <TextInput
            style={[styles.input, priceFocused && styles.inputFocused]}
            placeholder="예: 5000"
            placeholderTextColor={COLORS.textMuted}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            returnKeyType="next"
            onFocus={() => setPriceFocused(true)}
            onBlur={() => setPriceFocused(false)}
          />
        </View>

        {/* Weight */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>크기 / 무게</Text>
          <TextInput
            style={[styles.input, weightFocused && styles.inputFocused]}
            placeholder="예: 10cm, 10g"
            placeholderTextColor={COLORS.textMuted}
            value={weight}
            onChangeText={setWeight}
            returnKeyType="next"
            onFocus={() => setWeightFocused(true)}
            onBlur={() => setWeightFocused(false)}
          />
        </View>

        {/* Quantity */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>수량 (마리)</Text>
          <TextInput
            style={[styles.input, quantityFocused && styles.inputFocused]}
            placeholder="예: 5"
            placeholderTextColor={COLORS.textMuted}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            returnKeyType="next"
            onFocus={() => setQuantityFocused(true)}
            onBlur={() => setQuantityFocused(false)}
          />
        </View>

        {/* Trade Type */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>거래 방식 *</Text>
          <View style={styles.tradeRow}>
            {TRADE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.tradePill, tradeType === type && styles.tradePillActive]}
                onPress={() => setTradeType(type)}
              >
                <Text style={[styles.tradePillText, tradeType === type && styles.tradePillTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>거래 지역</Text>
          <TextInput
            style={[styles.input, locationFocused && styles.inputFocused]}
            placeholder="예: 서울 강남구"
            placeholderTextColor={COLORS.textMuted}
            value={location}
            onChangeText={setLocation}
            returnKeyType="next"
            onFocus={() => setLocationFocused(true)}
            onBlur={() => setLocationFocused(false)}
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>상품 설명</Text>
          <TextInput
            style={[styles.input, styles.textArea, descFocused && styles.inputFocused]}
            placeholder="상품에 대한 자세한 설명을 작성해주세요"
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
          />
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

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
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: FONTS.extrabold,
    color: COLORS.text,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: FONTS.semibold,
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  inputFocused: {
    borderColor: COLORS.primary,
  },
  textArea: {
    height: 120,
    paddingTop: 14,
    paddingBottom: 14,
  },
  imageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  imageThumbnailContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  imageThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: COLORS.divider,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  removeImageBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: FONTS.bold,
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
    fontWeight: FONTS.bold,
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageBtnIcon: {
    fontSize: 24,
    color: COLORS.primary,
    lineHeight: 28,
  },
  addImageBtnText: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 2,
    fontWeight: FONTS.medium,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillText: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: FONTS.medium,
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: FONTS.semibold,
  },
  tradeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tradePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  tradePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tradePillText: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: FONTS.medium,
  },
  tradePillTextActive: {
    color: '#FFFFFF',
    fontWeight: FONTS.semibold,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: FONTS.bold,
  },
  bottomSpacer: {
    height: 40,
  },
});
