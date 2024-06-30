package com.brewed_awakening.user_service.service;

import com.brewed_awakening.user_service.data.AppUserRepository;
import com.brewed_awakening.user_service.domain.AppUser;
import com.brewed_awakening.user_service.domain.OrderResponseModel;
import com.brewed_awakening.user_service.domain.UserDto;
import com.brewed_awakening.user_service.utils.JwtUtil;
import com.brewed_awakening.user_service.utils.UsersServiceException;
import org.modelmapper.ModelMapper;
import org.modelmapper.convention.MatchingStrategies;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.env.Environment;
import org.springframework.http.*;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.springframework.security.core.userdetails.User;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import org.modelmapper.TypeToken;

@Service
public class UserServiceImpl implements UserService {
    BCryptPasswordEncoder bCryptPasswordEncoder;
    AppUserRepository usersRepository;
    JwtUtil jwtUtil;
    RestTemplate restTemplate;
    Environment environment;
    Logger logger = LoggerFactory.getLogger(this.getClass());

    @Autowired
    public UserServiceImpl(BCryptPasswordEncoder bCryptPasswordEncoder, AppUserRepository usersRepository,
                            JwtUtil jwtUtil, RestTemplate restTemplate, Environment environment) {
        this.bCryptPasswordEncoder = bCryptPasswordEncoder;
        this.usersRepository = usersRepository;
        this.jwtUtil = jwtUtil;
        this.restTemplate = restTemplate;
        this.environment = environment;
    }

    @Override
    public UserDto createUser(UserDto userDto) {

        ModelMapper modelMapper = new ModelMapper();
        modelMapper.getConfiguration().setMatchingStrategy(MatchingStrategies.STRICT);

        AppUser userEntity = modelMapper.map(userDto, AppUser.class);

        userEntity.setUserId(UUID.randomUUID().toString());
        userEntity.setPassword(bCryptPasswordEncoder.encode(userDto.getPassword()));

        usersRepository.save(userEntity);

        return modelMapper.map(userEntity, UserDto.class);
    }

    @Override
    public UserDto getUserByUsername(String username) {
        AppUser userEntity = usersRepository.findByUsername(username);

        if (userEntity == null) {
            throw new UsernameNotFoundException(username);
        }

        return new ModelMapper().map(userEntity, UserDto.class);
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        AppUser userEntity = usersRepository.findByUsername(username);

        if (userEntity == null) {
            throw new UsernameNotFoundException(username);
        }

        return new User(userEntity.getUsername(), userEntity.getPassword(), true, // Email verification status
                true, true, true, new ArrayList<>());
    }

    @Override
    public void deleteUser(String userId, String authorizationHeader) {

        String userIdFromHeader = jwtUtil.getUserId(authorizationHeader);

        if (!userId.equalsIgnoreCase(userIdFromHeader)) {
            throw new UsersServiceException("Operation not allowed");
        }

        AppUser userEntity = usersRepository.findByUserId(userId);

        if (userEntity == null)
            throw new UsersServiceException("User not found");

        usersRepository.delete(userEntity);

    }

    @Override
    public UserDto getUserByUserId(String userId) throws UsersServiceException {
        AppUser userEntity = usersRepository.findByUserId(userId);

        if (userEntity == null)
            throw new UsersServiceException(environment.getProperty("users.exceptions.user-not-found"));

        return new ModelMapper().map(userEntity, UserDto.class);
    }

    @Override
    public List<UserDto> getUsers() {
        List<AppUser> userEntities = (List<AppUser>) usersRepository.findAll();

        if (userEntities == null || userEntities.isEmpty())
            return new ArrayList<>();

        Type listType = new TypeToken<List<UserDto>>() {
        }.getType();

        List<UserDto> returnValue = new ModelMapper().map(userEntities, listType);

        return returnValue;
    }


    @Override
    public List<OrderResponseModel> getUserOrders(String jwt) {

        String ordersUrl = environment.getProperty("orders.url");
        logger.info("ordersUrl = " + ordersUrl);

        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.add("Authorization", "Bearer " + jwt);
        httpHeaders.setAccept(Arrays.asList(MediaType.APPLICATION_JSON));

        ResponseEntity<List<OrderResponseModel>> ordersListResponse = restTemplate.exchange(ordersUrl, HttpMethod.GET,
                new HttpEntity<>(httpHeaders), new ParameterizedTypeReference<List<OrderResponseModel>>() {
                });

        logger.info(
                "Orders web service endpoint called and recieved " + ordersListResponse.getBody().size() + " items");

        return ordersListResponse.getBody();
    }

}
