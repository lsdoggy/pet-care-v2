package com.petcare.backend.shopping;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.petcare.backend.food.FoodProductService;
import com.petcare.backend.food.dto.FoodProductDto;
import com.petcare.backend.shopping.dto.CreateShoppingItemRequest;
import com.petcare.backend.shopping.dto.PurchaseItemRequest;
import com.petcare.backend.shopping.dto.ShoppingItemDto;
import com.petcare.backend.shopping.dto.UpdateShoppingItemRequest;

import jakarta.validation.Valid;

/**
 * Sprint 5: Shopping list CRUD + purchase endpoint + low-stock suggestions.
 * Layering: Controller -> {@link ShoppingListService} -> Repository; no business logic here.
 */
@RestController
@RequestMapping("/api/v1/shopping-list")
public class ShoppingListController {

    private final ShoppingListService shoppingListService;
    private final FoodProductService foodProductService;

    public ShoppingListController(ShoppingListService shoppingListService,
                                  FoodProductService foodProductService) {
        this.shoppingListService = shoppingListService;
        this.foodProductService = foodProductService;
    }

    /** Checklist of the current user: open items first, then purchased. */
    @GetMapping("/items")
    List<ShoppingItemDto> list(Authentication authentication) {
        return shoppingListService.listMyItems(authentication.getName());
    }

    @GetMapping("/items/{id}")
    ShoppingItemDto get(@PathVariable Long id, Authentication authentication) {
        return shoppingListService.getItem(id, authentication.getName());
    }

    /** Creates a linked item ("Add to Shopping List" button) or a custom quick-add item. */
    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    ShoppingItemDto create(@Valid @RequestBody CreateShoppingItemRequest request,
                           Authentication authentication) {
        return shoppingListService.createItem(request, authentication.getName());
    }

    @PatchMapping("/items/{id}")
    ShoppingItemDto update(@PathVariable Long id,
                           @Valid @RequestBody UpdateShoppingItemRequest request,
                           Authentication authentication) {
        return shoppingListService.updateItem(id, request, authentication.getName());
    }

    @DeleteMapping("/items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable Long id, Authentication authentication) {
        shoppingListService.deleteItem(id, authentication.getName());
    }

    /**
     * Marks an item purchased. Optional body { addStockQuantity } restocks the linked
     * product atomically (single @Transactional service call across both tables).
     */
    @PostMapping("/items/{id}/purchase")
    ShoppingItemDto purchase(@PathVariable Long id,
                             @Valid @RequestBody(required = false) PurchaseItemRequest request,
                             Authentication authentication) {
        return shoppingListService.purchaseItem(id, request, authentication.getName());
    }

    /** Low-stock products without an open list entry — UI suggestion banner. */
    @GetMapping("/suggestions")
    List<FoodProductDto> suggestions(Authentication authentication) {
        return foodProductService.listLowStockSuggestions(authentication.getName());
    }
}
