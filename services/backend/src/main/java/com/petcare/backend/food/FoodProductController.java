package com.petcare.backend.food;

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

import com.petcare.backend.food.dto.CreateFoodProductRequest;
import com.petcare.backend.food.dto.FoodProductDto;
import com.petcare.backend.food.dto.UpdateFoodProductRequest;

import jakarta.validation.Valid;

/**
 * Sprint 5: Food Products (stock) CRUD.
 * Layering: Controller -> {@link FoodProductService} -> Repository; no business logic here.
 */
@RestController
@RequestMapping("/api/v1/food-products")
public class FoodProductController {

    private final FoodProductService foodProductService;

    public FoodProductController(FoodProductService foodProductService) {
        this.foodProductService = foodProductService;
    }

    /** All products of the currently authenticated user, ordered by name. */
    @GetMapping
    List<FoodProductDto> list(Authentication authentication) {
        return foodProductService.listMyProducts(authentication.getName());
    }

    @GetMapping("/{id}")
    FoodProductDto get(@PathVariable Long id, Authentication authentication) {
        return foodProductService.getProduct(id, authentication.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    FoodProductDto create(@Valid @RequestBody CreateFoodProductRequest request,
                          Authentication authentication) {
        return foodProductService.createProduct(request, authentication.getName());
    }

    @PatchMapping("/{id}")
    FoodProductDto update(@PathVariable Long id,
                          @Valid @RequestBody UpdateFoodProductRequest request,
                          Authentication authentication) {
        return foodProductService.updateProduct(id, request, authentication.getName());
    }

    /** Hard delete; shopping items that referenced the product are unlinked, not deleted. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable Long id, Authentication authentication) {
        foodProductService.deleteProduct(id, authentication.getName());
    }
}
