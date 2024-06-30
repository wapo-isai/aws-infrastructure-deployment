package com.brewed_awakening.user_service.domain;

import java.util.List;

public class OrderResponseModel {
    private String orderNumber;
    private String userId;
    private List<Long> productIds;

    public OrderResponseModel(){}

    public OrderResponseModel(String orderNumber, String userId, List<Long> productIds) {
        this.orderNumber = orderNumber;
        this.userId = userId;
        this.productIds = productIds;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public void setOrderNumber(String orderNumber) {
        this.orderNumber = orderNumber;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public List<Long> getProductIds() {
        return productIds;
    }

    public void setProductIds(List<Long> productIds) {
        this.productIds = productIds;
    }
}
