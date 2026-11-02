package com.petcare.backend.shopping;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.error.AccessDeniedForResourceException;
import com.petcare.backend.error.FoodProductNotFoundException;
import com.petcare.backend.error.InvalidPurchaseOperationException;
import com.petcare.backend.error.ShoppingItemNotFoundException;
import com.petcare.backend.food.FoodProductEntity;
import com.petcare.backend.food.FoodProductRepository;
import com.petcare.backend.food.StockUnit;
import com.petcare.backend.shopping.dto.CreateShoppingItemRequest;
import com.petcare.backend.shopping.dto.PurchaseItemRequest;
import com.petcare.backend.shopping.dto.ShoppingItemDto;
import com.petcare.backend.shopping.dto.UpdateShoppingItemRequest;
import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;

/**
 * Sprint 5 business logic: shopping list checklist and the purchase transaction
 * (item + product stock updated atomically via {@code @Transactional}).
 */
@Service
public class ShoppingListService {

    private final ShoppingListRepository shoppingListRepository;
    private final FoodProductRepository foodProductRepository;
    private final UserRepository userRepository;

    public ShoppingListService(ShoppingListRepository shoppingListRepository,
                               FoodProductRepository foodProductRepository,
                               UserRepository userRepository) {
        this.shoppingListRepository = shoppingListRepository;
        this.foodProductRepository = foodProductRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<ShoppingItemDto> listMyItems(String email) {
        UserEntity user = resolveUser(email);
        return shoppingListRepository.findByOwnerIdOrderByPurchasedAscCreatedAtAsc(user.getId()).stream()
                .map(ShoppingItemDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ShoppingItemDto getItem(Long id, String email) {
        return ShoppingItemDto.from(loadOwnedItem(id, email));
    }

    /**
     * Creates a list entry in one of two modes (see {@link CreateShoppingItemRequest}):
     * linked to a catalog product (dedup guard: an OPEN item for the same product is not created twice —
     * the existing one is returned), or a free-form custom item.
     */
    @Transactional
    public ShoppingItemDto createItem(CreateShoppingItemRequest request, String email) {
        UserEntity user = resolveUser(email);

        if (request.isLinkedMode()) {
            FoodProductEntity product = foodProductRepository
                    .findByIdAndOwnerId(request.productId(), user.getId())
                    .orElseThrow(() -> new FoodProductNotFoundException(request.productId()));
            Optional<ShoppingListItemEntity> openDuplicate = findOpenItemForProduct(user.getId(), product.getId());
            if (openDuplicate.isPresent()) {
                // Idempotent "Add to Shopping List": return the already-open item.
                return ShoppingItemDto.from(openDuplicate.get());
            }
            int quantity = request.quantity() != null ? request.quantity() : 1;
            StockUnit unit = request.unit() != null ? request.unit() : product.getUnit();
            ShoppingListItemEntity item = new ShoppingListItemEntity(
                    user.getId(), product.getName().trim(), quantity, unit);
            item.setProductId(product.getId());
            return ShoppingItemDto.from(shoppingListRepository.save(item));
        }

        if (request.customName() == null || request.customName().isBlank()) {
            throw new InvalidPurchaseOperationException("Either productId or customName is required");
        }
        int quantity = request.quantity() != null ? request.quantity() : 1;
        StockUnit unit = request.unit() != null ? request.unit() : StockUnit.PCS;
        ShoppingListItemEntity item = new ShoppingListItemEntity(
                user.getId(), request.customName().trim(), quantity, unit);
        return ShoppingItemDto.from(shoppingListRepository.save(item));
    }

    /** PATCH semantics: null fields keep their current values. Purchase state changes only via /purchase. */
    @Transactional
    public ShoppingItemDto updateItem(Long id, UpdateShoppingItemRequest request, String email) {
        ShoppingListItemEntity item = loadOwnedItem(id, email);
        if (request.customName() != null && !request.customName().isBlank()) {
            item.setCustomName(request.customName().trim());
        }
        if (request.quantity() != null) {
            item.setQuantity(request.quantity());
        }
        if (request.unit() != null) {
            item.setUnit(request.unit());
        }
        return ShoppingItemDto.from(item);
    }

    @Transactional
    public void deleteItem(Long id, String email) {
        loadOwnedItem(id, email);
        shoppingListRepository.deleteById(id);
    }

    /**
     * Marks an item purchased. Transactional across BOTH tables:
     * 1. shopping_list_items → is_purchased = true, purchased_at = now();
     * 2. optionally food_products.stock_quantity += addStockQuantity (linked products only).
     * Idempotent: re-purchasing keeps the original purchased_at and does not restock again.
     * Restocking a custom (unlinked) item is rejected with 400 (approved plan decision #2).
     */
    @Transactional
    public ShoppingItemDto purchaseItem(Long id, PurchaseItemRequest request, String email) {
        UserEntity user = resolveUser(email);
        ShoppingListItemEntity item = shoppingListRepository.findByIdAndOwnerId(id, user.getId())
                .orElseThrow(() -> new ShoppingItemNotFoundException(id));
        Integer addStock = request != null ? request.addStockQuantity() : null;

        if (addStock != null && addStock > 0 && item.getProductId() == null) {
            throw new InvalidPurchaseOperationException(
                    "addStockQuantity can only be applied to items linked to a food product");
        }

        // Load the product BEFORE flipping the flag so that any failure rolls back both rows.
        FoodProductEntity product = item.getProductId() != null
                ? foodProductRepository.findByIdAndOwnerId(item.getProductId(), user.getId())
                        .orElseThrow(() -> new FoodProductNotFoundException(item.getProductId()))
                : null;

        if (!item.isPurchased()) {
            item.setPurchased(true); // entity also stamps purchased_at (keeps DB CHECK consistent)

            if (addStock != null && addStock > 0 && product != null) {
                // Same transaction as the item update above — both rows commit or roll back together.
                int next = Math.max(0, product.getStockQuantity() + addStock);
                product.setStockQuantity(next);
            }
        }
        return ShoppingItemDto.from(item);
    }

    /* ---------- Cross-service helpers (Sprint 5 linkage) ---------- */

    /** Duplicate guard used by createItem and the feeding-task linkage in CareTaskService. */
    @Transactional(readOnly = true)
    public Optional<ShoppingListItemEntity> findOpenItemForProduct(Long ownerId, Long productId) {
        return shoppingListRepository.findByOwnerIdAndProductIdAndPurchasedFalse(ownerId, productId)
                .stream().findFirst();
    }

    /** Case-insensitive lookup of open items by display name (feeding-task linkage). */
    @Transactional(readOnly = true)
    public List<ShoppingListItemEntity> findOpenItemsByName(Long ownerId, String name) {
        return shoppingListRepository.findByOwnerIdAndLowerCustomNameAndPurchasedFalse(
                ownerId, name.trim().toLowerCase());
    }

    /** Adds an open item linked to the given product (used by auto-linkage; no dedup here — caller guards). */
    @Transactional
    public ShoppingItemDto addOpenItemForProduct(FoodProductEntity product, int quantity) {
        ShoppingListItemEntity item = new ShoppingListItemEntity(
                product.getOwnerId(), product.getName().trim(), quantity, product.getUnit());
        item.setProductId(product.getId());
        return ShoppingItemDto.from(shoppingListRepository.save(item));
    }

    /**
     * Clears product_id on ALL items referencing a product that is being deleted
     * (open + purchased history rows). Called before the product row is removed.
     */
    @Transactional
    public void unlinkProductReferences(Long productId) {
        shoppingListRepository.findByProductId(productId)
                .forEach(item -> item.setProductId(null));
    }

    private ShoppingListItemEntity loadOwnedItem(Long id, String email) {
        UserEntity user = resolveUser(email);
        return shoppingListRepository.findByIdAndOwnerId(id, user.getId())
                .orElseThrow(() -> new ShoppingItemNotFoundException(id));
    }

    private UserEntity resolveUser(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new AccessDeniedForResourceException("User not found"));
    }
}
