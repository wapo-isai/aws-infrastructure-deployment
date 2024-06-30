package com.brewed_awakening.user_service.domain;

import java.util.List;

public class UserDto {
    private String userId;
    private String username;
    private String password;
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

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public List<OrderResponseModel> getOrders() {
        return orders;
    }

    public void setOrders(List<OrderResponseModel> orders) {
        this.orders = orders;
    }
}
