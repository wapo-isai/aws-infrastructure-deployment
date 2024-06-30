package com.brewed_awakening.user_service.domain;


import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class CreateUserRequestModel {

    @NotNull(message="Username cannot be null")
    @Size(min=2, message = "Username must not be less than 2 characters")
    private String username;

    @NotNull(message="Password cannot be null")
    @Size(min=8,max=16, message="Password must be equal or grater than 8 characters and less than 16 chaeracters")
    private String password;

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
}
