package com.petcare.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Sprint 5 integration tests: Food Products & Shopping List.
 * Covers CRUD, purchase transaction (item + stock), 400 for custom restock,
 * dedup/idempotency, low-stock suggestions and the simplified feeding-task linkage.
 */
@SpringBootTest
@AutoConfigureMockMvc
class FoodShoppingFlowTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    private String uniqueEmail() {
        return "fooduser" + System.nanoTime() + "@example.com";
    }

    private String registerAndLogin(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("email", email, "password", "Secret123!"))))
                .andExpect(status().isCreated());
        String loginBody = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("email", email, "password", "Secret123!"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(loginBody).get("accessToken").asText();
    }

    private long createPet(String token, String name) throws Exception {
        String body = mockMvc.perform(post("/api/v1/pets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("name", name, "species", "DOG"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(body).get("id").asLong();
    }

    private long createProduct(String token, Map<String, Object> payload) throws Exception {
        String body = mockMvc.perform(post("/api/v1/food-products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(body).get("id").asLong();
    }

    private Map<String, Object> dryFoodPayload(String name, int stock, int threshold, int portion) {
        Map<String, Object> p = new HashMap<>();
        p.put("name", name);
        p.put("category", "DRY");
        p.put("unit", "KG");
        p.put("stockQuantity", stock);
        p.put("reorderThreshold", threshold);
        p.put("dailyPortionGrams", portion);
        p.put("packageSizeGrams", 3000);
        return p;
    }

    private long createItem(String token, Map<String, Object> payload) throws Exception {
        String body = mockMvc.perform(post("/api/v1/shopping-list/items")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(body).get("id").asLong();
    }

    /* ---------------- Food product CRUD ---------------- */

    @Test
    void productCrudLifecycle() throws Exception {
        String token = registerAndLogin(uniqueEmail());

        long id = createProduct(token, dryFoodPayload("Acana Adult", 10, 2, 200));

        mockMvc.perform(get("/api/v1/food-products").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].category").value("DRY"))
                .andExpect(jsonPath("$[0].stockQuantity").value(10))
                .andExpect(jsonPath("$[0].lowStock").value(false));

        // PATCH: drop stock below threshold -> lowStock flag flips to true.
        mockMvc.perform(patch("/api/v1/food-products/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("stockQuantity", 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockQuantity").value(1))
                .andExpect(jsonPath("$.lowStock").value(true));

        mockMvc.perform(delete("/api/v1/food-products/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/food-products/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void validationRejectsBadPayloads() throws Exception {
        String token = registerAndLogin(uniqueEmail());

        // Missing required fields.
        mockMvc.perform(post("/api/v1/food-products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("unit", "PCS"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.details[?(@.field == 'name')]").exists());

        // Negative stock.
        mockMvc.perform(post("/api/v1/food-products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(dryFoodPayload("Bad", -5, 1, 100))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void productsAreIsolatedBetweenUsers() throws Exception {
        String tokenA = registerAndLogin(uniqueEmail());
        String tokenB = registerAndLogin(uniqueEmail());

        long productA = createProduct(tokenA, dryFoodPayload("Royal Canin", 5, 1, 150));

        mockMvc.perform(get("/api/v1/food-products/" + productA).header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());

        // User B cannot create a shopping item linked to user A's product.
        mockMvc.perform(post("/api/v1/shopping-list/items")
                        .header("Authorization", "Bearer " + tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("productId", productA))))
                .andExpect(status().isNotFound());
    }

    /* ---------------- Shopping list & purchase transaction ---------------- */

    @Test
    void purchaseRestocksLinkedProductAtomically() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long productId = createProduct(token, dryFoodPayload("Acana Puppy", 0, 2, 200));

        long itemId = createItem(token, Map.of("productId", productId, "quantity", 2));

        // Linked-item dedup: creating again returns the SAME open item (idempotent add).
        mockMvc.perform(post("/api/v1/shopping-list/items")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("productId", productId))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(itemId));

        mockMvc.perform(post("/api/v1/shopping-list/items/" + itemId + "/purchase")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("addStockQuantity", 3))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPurchased").value(true))
                .andExpect(jsonPath("$.purchasedAt").exists());

        // Both tables updated in one transaction.
        mockMvc.perform(get("/api/v1/food-products/" + productId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockQuantity").value(3));

        // Idempotent re-purchase: no double restock, purchased_at preserved.
        String first = mockMvc.perform(get("/api/v1/shopping-list/items/" + itemId)
                        .header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString();
        String firstPurchasedAt = JSON.readTree(first).get("purchasedAt").asText();

        mockMvc.perform(post("/api/v1/shopping-list/items/" + itemId + "/purchase")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("addStockQuantity", 3))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purchasedAt").value(firstPurchasedAt));

        mockMvc.perform(get("/api/v1/food-products/" + productId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockQuantity").value(3));
    }

    @Test
    void restockingCustomItemIsRejectedWith400() throws Exception {
        String token = registerAndLogin(uniqueEmail());

        long itemId = createItem(token, Map.of("customName", "Treat bones", "quantity", 1, "unit", "PCS"));

        mockMvc.perform(post("/api/v1/shopping-list/items/" + itemId + "/purchase")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("addStockQuantity", 5))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        // Item must remain OPEN — the rejected request changed nothing.
        mockMvc.perform(get("/api/v1/shopping-list/items/" + itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPurchased").value(false));

        // Purchase WITHOUT restock works fine for custom items.
        mockMvc.perform(post("/api/v1/shopping-list/items/" + itemId + "/purchase")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPurchased").value(true));
    }

    @Test
    void checklistOrderingOpenItemsFirst() throws Exception {
        String token = registerAndLogin(uniqueEmail());

        long custom = createItem(token, Map.of("customName", "Cat litter", "quantity", 1, "unit", "PCS"));
        long productId = createProduct(token, dryFoodPayload("Whiskas Wet", 0, 1, 80));
        long linked = createItem(token, Map.of("productId", productId));

        mockMvc.perform(post("/api/v1/shopping-list/items/" + custom + "/purchase")
                        .header("Authorization", "Bearer " + token));

        mockMvc.perform(get("/api/v1/shopping-list/items").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(linked))   // open first
                .andExpect(jsonPath("$[1].id").value(custom));  // purchased last
    }

    @Test
    void deleteProductUnlinksItemsButKeepsHistory() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long productId = createProduct(token, dryFoodPayload("Grandma's Corn", 0, 1, 50));
        long itemId = createItem(token, Map.of("productId", productId));

        mockMvc.perform(delete("/api/v1/food-products/" + productId).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // Item survives as a custom (unlinked) row.
        mockMvc.perform(get("/api/v1/shopping-list/items/" + itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productId").doesNotExist())
                .andExpect(jsonPath("$.customName").value("Grandma's Corn"));
    }

    /* ---------------- Suggestions & feeding-task linkage ---------------- */

    @Test
    void suggestionsListLowStockProductsWithoutOpenItem() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long lowId = createProduct(token, dryFoodPayload("Hills a/d", 1, 2, 100));
        createProduct(token, dryFoodPayload("Full Stock", 50, 2, 100));

        mockMvc.perform(get("/api/v1/shopping-list/suggestions").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + lowId + ")]").exists());

        // Adding an open item removes it from suggestions.
        createItem(token, Map.of("productId", lowId));

        mockMvc.perform(get("/api/v1/shopping-list/suggestions").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + lowId + ")]").doesNotExist());
    }

    @Test
    void completingFeedingTaskConsumesStockAndAutoAddsToShoppingList() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long petId = createPet(token, "Rex");
        // Stock 200g, threshold 100g, daily portion 150g -> after feeding: 50g <= 100g => low stock.
        long productId = createProduct(token, dryFoodPayload("Pro Plan Adult", 200, 100, 150));

        String taskBody = mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", petId,
                                "title", "pro plan adult", // case-insensitive match
                                "type", "FOOD",
                                "dueAt", Instant.now().plus(1, ChronoUnit.HOURS).toString()))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long taskId = JSON.readTree(taskBody).get("id").asLong();

        mockMvc.perform(post("/api/v1/tasks/" + taskId + "/complete").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));

        // Stock consumed by the daily portion.
        mockMvc.perform(get("/api/v1/food-products/" + productId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockQuantity").value(50))
                .andExpect(jsonPath("$.lowStock").value(true));

        // Auto-added OPEN shopping item linked to the product.
        mockMvc.perform(get("/api/v1/shopping-list/items").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].customName").value("Pro Plan Adult"))
                .andExpect(jsonPath("$[0].productId").value(productId))
                .andExpect(jsonPath("$[0].isPurchased").value(false));

        // Second feeding does NOT duplicate the open item (dedup guard).
        String task2 = mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", petId,
                                "title", "Pro Plan Adult",
                                "type", "FOOD",
                                "dueAt", Instant.now().plus(1, ChronoUnit.HOURS).toString()))))
                .andReturn().getResponse().getContentAsString();
        long taskId2 = JSON.readTree(task2).get("id").asLong();

        mockMvc.perform(post("/api/v1/tasks/" + taskId2 + "/complete").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/food-products/" + productId).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.stockQuantity").value(0)); // clamped at 0, never negative

        mockMvc.perform(get("/api/v1/shopping-list/items").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void unauthorizedAccessIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/food-products"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/shopping-list/items"))
                .andExpect(status().isUnauthorized());
    }
}
