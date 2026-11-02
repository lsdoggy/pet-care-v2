-- Sprint 5: Food Products & Shopping List.
-- Ownership model follows care_tasks/veterinary_appointments: owner_id is denormalized
-- for fast ownership checks and per-user listings.

CREATE TABLE food_products (
    id                    BIGSERIAL    PRIMARY KEY,
    owner_id              BIGINT       NOT NULL REFERENCES users (id),
    name                  VARCHAR(150) NOT NULL,
    brand                 VARCHAR(150),
    -- Category enum stored UPPERCASE: DRY | WET | TREAT | SUPPLEMENT | LITTER
    category              VARCHAR(20)  NOT NULL DEFAULT 'DRY'
                          CHECK (category IN ('DRY', 'WET', 'TREAT', 'SUPPLEMENT', 'LITTER')),
    package_size_grams    INT          CHECK (package_size_grams IS NULL OR package_size_grams > 0),
    daily_portion_grams   INT          CHECK (daily_portion_grams IS NULL OR daily_portion_grams >= 0),
    stock_quantity        INT          NOT NULL DEFAULT 0
                          CHECK (stock_quantity >= 0),
    reorder_threshold     INT          NOT NULL DEFAULT 0
                          CHECK (reorder_threshold >= 0),
    -- Unit of the stock counter: pcs | kg | g
    unit                  VARCHAR(10)  NOT NULL DEFAULT 'PCS'
                          CHECK (unit IN ('PCS', 'KG', 'G')),
    notes                 TEXT,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- "My stock" listing ordered by name.
CREATE INDEX idx_food_products_owner ON food_products (owner_id, name);

CREATE TABLE shopping_list_items (
    id            BIGSERIAL    PRIMARY KEY,
    owner_id      BIGINT       NOT NULL REFERENCES users (id),
    -- Optional link to a catalog product; custom one-off items keep it NULL.
    -- ON DELETE SET NULL: deleting a product must not destroy list rows.
    product_id    BIGINT       REFERENCES food_products (id) ON DELETE SET NULL,
    custom_name   VARCHAR(150) NOT NULL,
    quantity      INT          NOT NULL DEFAULT 1
                CHECK (quantity BETWEEN 1 AND 999),
    -- Unit of the requested quantity: pcs | kg | g
    unit          VARCHAR(10)  NOT NULL DEFAULT 'PCS'
                CHECK (unit IN ('PCS', 'KG', 'G')),
    is_purchased  BOOLEAN      NOT NULL DEFAULT FALSE,
    purchased_at  TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    -- Consistency: purchased rows carry a timestamp, open rows do not.
    CONSTRAINT chk_shopping_purchased_at CHECK (
        (is_purchased AND purchased_at IS NOT NULL) OR (NOT is_purchased AND purchased_at IS NULL)
    )
);

-- Checklist listing: WHERE owner_id = ? ORDER BY is_purchased, created_at.
CREATE INDEX idx_shopping_items_owner ON shopping_list_items (owner_id, is_purchased, created_at);
CREATE INDEX idx_shopping_items_product ON shopping_list_items (product_id);
