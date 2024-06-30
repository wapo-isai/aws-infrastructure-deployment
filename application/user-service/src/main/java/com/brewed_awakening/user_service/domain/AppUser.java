package com.brewed_awakening.user_service.domain;

import jakarta.persistence.*;

@Entity
public class AppUser {
    @Id
    @GeneratedValue(strategy= GenerationType.AUTO)
    @Column(nullable=false, updatable=false)
    private long id;

    @Column(nullable = false, unique = true)
    private String userId;

    @Column(nullable=false, unique=true)
    private String username;

    @Column(nullable=false)
    private String password;

    public Long getId() {
        return id;
    }
    public void setId(Long id) {
        this.id = id;
    }

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
}
