import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api/client';
import type { FoodProductDto } from '../api/types';
import { FOOD_CATEGORY_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { ScreenHeader } from '../components/ScreenHeader';

/** Progress bar denominator: package size if set, otherwise threshold*2. */
function stockPercent(p: FoodProductDto): number {
  const capacity = p.packageSizeGrams && p.packageSizeGrams > 0 ? p.packageSizeGrams : Math.max(p.reorderThreshold * 2, 1);
  return Math.min(100, Math.round((p.stockQuantity / capacity) * 100));
}

/**
 * Sprint 5 mobile "Stock" screen: read-only overview of food products with a stock
 * progress bar and +/- quick controls (PATCH stock_quantity). Low-stock items are
 * highlighted; the purchase restock itself happens via the Buy tab checklist.
 */
export function StockScreen() {
  const [products, setProducts] = useState<FoodProductDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      setProducts(await api.listFoodProducts(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stock');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3000);
  }, []);

  const adjustStock = useCallback(
    async (product: FoodProductDto, delta: number) => {
      const next = Math.max(0, product.stockQuantity + delta);
      if (next === product.stockQuantity) return;
      setBusyId(product.id);
      setError(null);
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        const updated = await api.updateFoodProduct(product.id, { stockQuantity: next }, token);
        setProducts((prev) => (prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev));
        if (updated.lowStock) flash(`"${updated.name}" is low — add it in the Buy tab.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update stock');
      } finally {
        setBusyId(null);
      }
    },
    [flash],
  );

  const addToShoppingList = useCallback(
    async (product: FoodProductDto) => {
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        await api.createShoppingItem({ productId: product.id }, token);
        flash(`"${product.name}" added to the shopping list.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add to shopping list');
      }
    },
    [flash],
  );

  if (products === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Shared navigation-shell header (Design Sprint 0, Step 5). */}
      <ScreenHeader title="Food stock" />
      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}
      <FlatList
        data={products ?? []}
        keyExtractor={(item) => `product-${item.id}`}
        ListEmptyComponent={<Text style={styles.empty}>No products yet. Add them on the web app.</Text>}
        contentContainerStyle={{ paddingBottom: 16 }}
        renderItem={({ item }) => {
          const pct = stockPercent(item);
          const busy = busyId === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {FOOD_CATEGORY_LABELS[item.category]}
                    {item.brand ? ` · ${item.brand}` : ''}
                     · {item.stockQuantity === 0 ? 'Out of stock' : item.lowStock ? 'Low stock' : 'In stock'}
                  </Text>
                </View>
                <Text style={[styles.qty, item.lowStock && styles.qtyLow]}>
                  {item.stockQuantity} {item.unit.toLowerCase()}
                </Text>
              </View>

              {/* Stock progress bar */}
              <View style={styles.barTrack} accessibilityRole="progressbar" accessibilityLabel={`Stock level for ${item.name}`} accessibilityValue={{ min: 0, max: 100, now: pct }}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%`, backgroundColor: item.lowStock ? '#c0392b' : pct < 50 ? '#f39c12' : '#27ae60' },
                  ]}
                />
              </View>
              <Text style={styles.hint}>
                Reorder at ≤ {item.reorderThreshold} {item.unit.toLowerCase()} · {pct}%
              </Text>

              <View style={styles.actionsRow}>
                <Pressable style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="Decrease stock" disabled={busy || item.stockQuantity === 0} onPress={() => void adjustStock(item, -1)}>
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Pressable style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="Increase stock" disabled={busy} onPress={() => void adjustStock(item, 1)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
                <Pressable style={styles.cartBtn} disabled={busy} onPress={() => void addToShoppingList(item)}>
                  <Text style={styles.cartBtnText}>🛒 Add to list</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb', paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f7fb' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', paddingHorizontal: 16, marginBottom: 10 },
  error: { color: '#c0392b', paddingHorizontal: 16, marginBottom: 8, fontSize: 13 },
  notice: { color: '#27ae60', paddingHorizontal: 16, marginBottom: 8, fontSize: 13 },
  empty: { color: '#6b7280', paddingHorizontal: 16, fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  qty: { fontSize: 15, fontWeight: '700', color: '#2c3e50' },
  qtyLow: { color: '#c0392b' },
  barTrack: { height: 8, backgroundColor: '#edf2f7', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  hint: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  stepBtnText: { fontSize: 17, color: '#2c3e50', fontWeight: '700' },
  cartBtn: {
    marginLeft: 'auto',
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cartBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
