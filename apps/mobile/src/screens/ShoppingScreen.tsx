import { STOCK_UNIT_LABELS } from '../api/types';
import { useLanguage } from '../i18n/language';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/Typography';
import { api, ApiError } from '../api/client';
import type { FoodProductDto, ShoppingItemDto } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';
import { ScreenHeader } from '../components/ScreenHeader';

/**
 * Sprint 5 mobile "Buy" tab: quick-add a shopping item and check off purchases.
 * Tapping the checkbox calls POST /shopping-list/items/{id}/purchase; for items linked
 * to a catalog product we send addStockQuantity = item.quantity so the backend restocks
 * the product in the same transaction (server-side @Transactional).
 */
export function ShoppingScreen() {
  const language = useLanguage();
  const navigation = useNavigation();
  const [items, setItems] = useState<ShoppingItemDto[] | null>(null);
  const [suggestions, setSuggestions] = useState<FoodProductDto[]>([]);
  const [error, setError] = useState<Record<'ru' | 'en', string> | null>(null);
  const [quickName, setQuickName] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      const [list, sugg] = await Promise.all([api.listShoppingItems(token), api.listShoppingSuggestions(token)]);
      setItems(list);
      setSuggestions(sugg);
    } catch {
      setError({ ru: 'Не удалось загрузить покупки.', en: 'Failed to load shopping list' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addItem = useCallback(async () => {
    const name = quickName.trim();
    if (!name) return;
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      await api.createShoppingItem({ customName: name }, token);
      setQuickName('');
      await load();
    } catch {
      setError({ ru: 'Не удалось добавить покупку.', en: 'Failed to add item' });
    }
  }, [quickName, load]);

  /** Checkbox tap → mark purchased (restocks the linked product server-side, atomically). */
  const togglePurchased = useCallback(
    async (item: ShoppingItemDto) => {
      if (item.isPurchased) return; // un-purchasing is out of scope for this sprint
      setBusyId(item.id);
      setError(null);
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        await api.purchaseShoppingItem(
          item.id,
          item.productId != null ? { addStockQuantity: item.quantity } : null,
          token,
        );
        await load();
      } catch {
        setError({ ru: 'Не удалось обновить покупку.', en: 'Failed to update item' });
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const removeItem = useCallback(
    async (item: ShoppingItemDto) => {
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        await api.deleteShoppingItem(item.id, token);
        setItems((prev) => (prev ? prev.filter((x) => x.id !== item.id) : prev));
      } catch {
        setError({ ru: 'Не удалось удалить покупку.', en: 'Failed to remove item' });
      }
    },
    [],
  );

  const addSuggestion = useCallback(
    async (product: FoodProductDto) => {
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        await api.createShoppingItem({ productId: product.id }, token);
        await load();
      } catch {
        setError({ ru: 'Не удалось добавить предложенный товар.', en: 'Failed to add suggestion' });
      }
    },
    [load],
  );

  if (items === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const open = (items ?? []).filter((i) => !i.isPurchased);
  const purchased = (items ?? []).filter((i) => i.isPurchased);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>
        {/* Shared navigation-shell header (Design Sprint 0, Step 5). */}
        <ScreenHeader
          title={language === 'ru' ? 'Список покупок' : 'Shopping list'}
          actions={
            <Pressable
              onPress={() => navigation.push({ name: 'Stock' })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={language === 'ru' ? 'Открыть запасы корма' : 'Open food stock'}
            >
              <Text style={styles.stockLink}>{language === 'ru' ? 'Запасы 📦' : 'Stock 📦'}</Text>
            </Pressable>
          }
        />

        {/* Quick add row — the primary mobile flow of this sprint */}
        <View style={styles.quickAddRow}>
          <TextInput
            style={styles.input}
            value={quickName}
            onChangeText={setQuickName}
            placeholder={language === 'ru' ? 'Добавить покупку, например лакомство с лососем' : 'Add item… e.g. Salmon treats'}
            placeholderTextColor="#9ca3af"
            maxLength={150}
            returnKeyType="done"
            onSubmitEditing={() => void addItem()}
          />
          <Pressable style={[styles.addBtn, !quickName.trim() && styles.addBtnDisabled]} onPress={() => void addItem()}>
            <Text style={styles.addBtnText}>{language === 'ru' ? 'Добавить' : 'Add'}</Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error[language]}</Text>}

        {suggestions.length > 0 && (
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionTitle}>{language === 'ru' ? 'Заканчивается — нажмите, чтобы добавить:' : 'Running low — tap to add:'}</Text>
            {suggestions.map((s) => (
              <Pressable key={s.id} style={styles.suggestionRow} onPress={() => void addSuggestion(s)}>
                <Text style={styles.suggestionText}>
                  + {s.name} ({s.stockQuantity} {STOCK_UNIT_LABELS[language][s.unit]} {language === 'ru' ? 'осталось' : 'left'})
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <FlatList
          data={open}
          keyExtractor={(item) => `open-${item.id}`}
          ListEmptyComponent={<Text style={styles.empty}>{language === 'ru' ? 'Покупок пока нет 🎉' : 'Nothing to buy 🎉'}</Text>}
          renderItem={({ item }) => {
            const busy = busyId === item.id;
            return (
              <View style={styles.row}>
                <Pressable
                  style={[styles.checkbox, busy && styles.checkboxBusy]}
                  onPress={() => void togglePurchased(item)}
                  disabled={busy}
                  accessibilityLabel={language === 'ru' ? `Отметить «${item.customName}» купленным` : `Mark ${item.customName} purchased`}
                  hitSlop={9}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: false, disabled: busy }}
                >
                  <Text style={styles.checkboxInner}>{busy ? '…' : ''}</Text>
                </Pressable>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.itemName}>{item.customName}</Text>
                  <Text style={styles.itemMeta}>
                    × {item.quantity} {STOCK_UNIT_LABELS[language][item.unit]}
                    {item.productId != null ? (language === 'ru' ? ' · из каталога' : ' · from catalog') : ''}
                  </Text>
                </View>
                <Pressable onPress={() => void removeItem(item)} accessibilityRole="button" accessibilityLabel={language === 'ru' ? `Удалить «${item.customName}»` : `Remove ${item.customName}`} disabled={busyId === item.id} style={styles.removeBtn}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            );
          }}
          ListHeaderComponent={<Text style={styles.sectionTitle}>{language === 'ru' ? 'Купить' : 'To buy'} ({open.length})</Text>}
          ListFooterComponent={
            purchased.length > 0 ? (
              <View>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{language === 'ru' ? 'Куплено' : 'Purchased'}</Text>
                {purchased.map((item) => (
                  <View key={`done-${item.id}`} style={[styles.row, styles.rowDone]}>
                    <View style={[styles.checkbox, styles.checkboxChecked]}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                    <View style={styles.rowTextWrap}>
                      <Text style={[styles.itemName, styles.itemNameDone]}>{item.customName}</Text>
                      <Text style={styles.itemMeta}>× {item.quantity} {STOCK_UNIT_LABELS[language][item.unit]}</Text>
                    </View>
                    <Pressable onPress={() => void removeItem(item)} accessibilityRole="button" accessibilityLabel={language === 'ru' ? `Удалить «${item.customName}»` : `Remove ${item.customName}`} disabled={busyId === item.id} style={styles.removeBtn}>
                      <Text style={styles.removeText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : undefined
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb', paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f7fb' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  stockLink: { fontSize: 15, color: '#4f46e5', fontWeight: '600' },
  quickAddRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginVertical: 12 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  addBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: '#c0392b', paddingHorizontal: 16, marginBottom: 8, fontSize: 13 },
  suggestionBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff8e1',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f6d365',
    padding: 12,
  },
  suggestionTitle: { fontSize: 13, fontWeight: '700', color: '#92670f', marginBottom: 6 },
  suggestionRow: { paddingVertical: 4 },
  suggestionText: { fontSize: 14, color: '#7a5b12' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', paddingHorizontal: 16, marginBottom: 8 },
  empty: { color: '#6b7280', paddingHorizontal: 16, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
  },
  rowDone: { opacity: 0.65 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxBusy: { backgroundColor: '#eef2ff' },
  checkboxChecked: { backgroundColor: '#27ae60', borderColor: '#27ae60' },
  checkboxInner: { color: '#4f46e5', fontWeight: '700' },
  checkMark: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rowTextWrap: { flex: 1 },
  itemName: { fontSize: 15, color: '#111827', fontWeight: '600' },
  itemNameDone: { textDecorationLine: 'line-through', color: '#6b7280' },
  itemMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  removeBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#94a3b8', fontSize: 16 },
});
