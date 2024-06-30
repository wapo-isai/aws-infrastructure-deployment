package com.brewed_awakening.order_service.dto;

import java.util.List;

public class Order {
    private String userId;

    private String orderNumber;

    private List<Long> productIds;

    private float totalPrice;

    public Order(){}

    public Order(String userId, String orderNumber, List<Long> productIds, float totalPrice) {
        this.userId = userId;
        this.orderNumber = orderNumber;
        this.productIds = productIds;
        this.totalPrice = totalPrice;
    }

    public float getTotalPrice() {
        return totalPrice;
    }

    public void setTotalPrice(float totalPrice) {
        this.totalPrice = totalPrice;
    }

    public List<Long> getProductIds() {
        return productIds;
    }

    public void setProductIds(List<Long> productIds) {
        this.productIds = productIds;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public void setOrderNumber(String orderNumber) {
        this.orderNumber = orderNumber;
    }

}
