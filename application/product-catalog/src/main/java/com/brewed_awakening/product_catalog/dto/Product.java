package com.brewed_awakening.product_catalog.dto;

public class Product {
    private long productId;

    private Double productPrice;


    public Product(){}

    public Product(long productId, Double productPrice) {
        this.productId = productId;
        this.productPrice = productPrice;
    }

    public long getProductId() {
        return productId;
    }

    public void setProductId(long productId) {
        this.productId = productId;
    }

    public Double getProductPrice() {
        return productPrice;
    }

    public void setProductPrice(Double productPrice) {
        this.productPrice = productPrice;
    }
}
