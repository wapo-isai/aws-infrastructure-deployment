package com.brewed_awakening.user_service.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

public class UserResponseModel {
    private String userId;
    private String username;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<OrderResponseModel> orders;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public List<OrderResponseModel> getOrders() {
        return orders;
    }

    public void setOrders(List<OrderResponseModel> orders) {
        this.orders = orders;
    }
}
