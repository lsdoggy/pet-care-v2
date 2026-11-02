package com.petcare.backend.shopping;

import java.time.Instant;

import com.petcare.backend.food.StockUnit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "shopping_list_items")
public class ShoppingListItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Denormalized for ownership checks and per-user listings (same pattern as care_tasks). */
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    /** Optional link to a catalog product; custom one-off items keep it null. */
    @Column(name = "product_id")
    private Long productId;

    /** Display name: copied from the linked product or typed manually for custom items. */
    @Column(name = "custom_name", nullable = false)
    private String customName;

    @Column(nullable = false)
    private int quantity = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private StockUnit unit = StockUnit.PCS;

    @Column(name = "is_purchased", nullable = false)
    private boolean purchased = false;

    @Column(name = "purchased_at")
    private Instant purchasedAt;

    /** DB-generated lowercased copy of custom_name (case-insensitive duplicate checks); never written by JPA. */
    @Column(name = "lower_custom_name", insertable = false, updatable = false)
    private String lowerCustomName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ShoppingListItemEntity() {
    }

    public ShoppingListItemEntity(Long ownerId, String customName, int quantity, StockUnit unit) {
        this.ownerId = ownerId;
        this.customName = customName;
        this.quantity = quantity;
        this.unit = unit;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public String getCustomName() {
        return customName;
    }

    public void setCustomName(String customName) {
        this.customName = customName;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public StockUnit getUnit() {
        return unit;
    }

    public void setUnit(StockUnit unit) {
        this.unit = unit;
    }

    public boolean isPurchased() {
        return purchased;
    }

    public void setPurchased(boolean purchased) {
        this.purchased = purchased;
        // Keep the DB CHECK consistent: purchased_at exists iff is_purchased is true.
        this.purchasedAt = purchased ? (purchasedAt != null ? purchasedAt : Instant.now()) : null;
    }

    public Instant getPurchasedAt() {
        return purchasedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
