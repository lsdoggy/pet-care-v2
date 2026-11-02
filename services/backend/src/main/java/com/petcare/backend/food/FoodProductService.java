package com.petcare.backend.food;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.error.AccessDeniedForResourceException;
import com.petcare.backend.error.FoodProductNotFoundException;
import com.petcare.backend.food.dto.CreateFoodProductRequest;
import com.petcare.backend.food.dto.FoodProductDto;
import com.petcare.backend.food.dto.UpdateFoodProductRequest;
import com.petcare.backend.shopping.ShoppingListService;
import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;

/**
 * Sprint 5 business logic: food product catalog (stock tracking).
 * Layering: Controller -> Service -> Repository. Ownership checks follow the CareTaskService pattern.
 */
@Service
public class FoodProductService {

    private final FoodProductRepository foodProductRepository;
    private final UserRepository userRepository;
    private final ShoppingListService shoppingListService;

    public FoodProductService(FoodProductRepository foodProductRepository,
                              UserRepository userRepository,
                              ShoppingListService shoppingListService) {
        this.foodProductRepository = foodProductRepository;
        this.userRepository = userRepository;
        this.shoppingListService = shoppingListService;
    }

    @Transactional(readOnly = true)
    public List<FoodProductDto> listMyProducts(String email) {
        UserEntity user = resolveUser(email);
        return foodProductRepository.findByOwnerIdOrderByNameAsc(user.getId()).stream()
                .map(FoodProductDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public FoodProductDto getProduct(Long id, String email) {
        return FoodProductDto.from(loadOwnedProduct(id, email));
    }

    @Transactional
    public FoodProductDto createProduct(CreateFoodProductRequest request, String email) {
        UserEntity user = resolveUser(email);
        FoodProductEntity product = new FoodProductEntity(
                user.getId(),
                request.name().trim(),
                request.category(),
                request.unit());
        applyFields(product, request.brand(), request.packageSizeGrams(), request.dailyPortionGrams(),
                request.stockQuantity(), request.reorderThreshold(), request.notes());
        return FoodProductDto.from(foodProductRepository.save(product));
    }

    /**
     * PATCH semantics: null fields keep their current values.
     * If after the update the stock drops to/below the reorder threshold, the service
     * suggests adding the product to the shopping list (MVP: suggestion only — the response's
     * {@code lowStock} flag drives the UI prompt; no silent row creation here).
     */
    @Transactional
    public FoodProductDto updateProduct(Long id, UpdateFoodProductRequest request, String email) {
        FoodProductEntity product = loadOwnedProduct(id, email);
        if (request.name() != null && !request.name().isBlank()) {
            product.setName(request.name().trim());
        }
        if (request.brand() != null) {
            product.setBrand(blankToNull(request.brand()));
        }
        if (request.category() != null) {
            product.setCategory(request.category());
        }
        if (request.packageSizeGrams() != null) {
            product.setPackageSizeGrams(request.packageSizeGrams());
        }
        if (request.dailyPortionGrams() != null) {
            product.setDailyPortionGrams(request.dailyPortionGrams());
        }
        if (request.stockQuantity() != null) {
            product.setStockQuantity(Math.max(0, request.stockQuantity()));
        }
        if (request.reorderThreshold() != null) {
            product.setReorderThreshold(Math.max(0, request.reorderThreshold()));
        }
        if (request.unit() != null) {
            product.setUnit(request.unit());
        }
        if (request.notes() != null) {
            product.setNotes(blankToNull(request.notes()));
        }
        return FoodProductDto.from(product);
    }

    @Transactional
    public void deleteProduct(Long id, String email) {
        FoodProductEntity product = loadOwnedProduct(id, email);
        // Unlink shopping items first (belt & braces alongside ON DELETE SET NULL),
        // so purchased history rows survive the product deletion.
        shoppingListService.unlinkProductReferences(product.getId());
        foodProductRepository.delete(product);
    }

    /* ---------- Shared helpers used by ShoppingListService / CareTaskService linkage ---------- */

    @Transactional(readOnly = true)
    public Optional<FoodProductEntity> findOwned(Long productId, Long ownerId) {
        return foodProductRepository.findByIdAndOwnerId(productId, ownerId);
    }

    /** Case-insensitive exact-name lookup (simplified feeding-task linkage, approved in plan item 3). */
    @Transactional(readOnly = true)
    public List<FoodProductEntity> findByOwnerAndExactName(Long ownerId, String name) {
        return foodProductRepository.findByOwnerAndNameIgnoreCase(ownerId, name.trim());
    }

    /** Adds delta to the stock counter, clamped at 0 (never negative — DB CHECK mirrors this). */
    @Transactional
    public int addStockQuantity(FoodProductEntity product, int delta) {
        int next = Math.max(0, product.getStockQuantity() + delta);
        product.setStockQuantity(next);
        return next;
    }

    /**
     * Low-stock products that have NO open shopping item yet — drives the
     * "Add to Shopping List?" suggestions banner on web/mobile (MVP simplification:
     * we suggest instead of silently creating rows).
     */
    @Transactional(readOnly = true)
    public List<FoodProductDto> listLowStockSuggestions(String email) {
        UserEntity user = resolveUser(email);
        return foodProductRepository.findByOwnerIdOrderByNameAsc(user.getId()).stream()
                .filter(FoodProductEntity::isLowStock)
                .filter(product -> shoppingListService.findOpenItemForProduct(user.getId(), product.getId()).isEmpty())
                .map(FoodProductDto::from)
                .toList();
    }

    FoodProductEntity loadOwnedProduct(Long id, String email) {
        UserEntity user = resolveUser(email);
        // findByIdAndOwnerId: one query, and no existence leak for other users' products.
        return foodProductRepository.findByIdAndOwnerId(id, user.getId())
                .orElseThrow(() -> new FoodProductNotFoundException(id));
    }

    private UserEntity resolveUser(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new AccessDeniedForResourceException("User not found"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static void applyFields(FoodProductEntity product, String brand, Integer packageSize,
                                    Integer dailyPortion, Integer stock, Integer threshold, String notes) {
        product.setBrand(blankToNull(brand));
        product.setPackageSizeGrams(packageSize);
        product.setDailyPortionGrams(dailyPortion);
        product.setStockQuantity(stock != null ? Math.max(0, stock) : 0);
        product.setReorderThreshold(threshold != null ? Math.max(0, threshold) : 0);
        product.setNotes(blankToNull(notes));
    }
}
