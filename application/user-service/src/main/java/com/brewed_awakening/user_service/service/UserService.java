package com.brewed_awakening.user_service.service;

import com.brewed_awakening.user_service.domain.OrderResponseModel;
import com.brewed_awakening.user_service.domain.UserDto;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.util.List;

public interface UserService extends UserDetailsService {
    public List<UserDto> getUsers();
    public UserDto createUser(UserDto userDto);
    public UserDto getUserByUsername(String username);
    public UserDto getUserByUserId(String userId);
    public void deleteUser(String userId, String authorizationHeader);
    public List<OrderResponseModel> getUserOrders(String jwt);
}
