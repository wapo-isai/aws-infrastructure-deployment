package com.brewed_awakening.user_service.controller;

import com.brewed_awakening.user_service.domain.*;
import com.brewed_awakening.user_service.service.UserService;
import jakarta.validation.Valid;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PostAuthorize;
import org.springframework.web.bind.annotation.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;


@RestController
@RequestMapping("/users")
@CrossOrigin(origins = "*")
public class LoginController {
    @Autowired
    private final UserService userService;

    private final Logger log = LoggerFactory.getLogger(this.getClass());

    public LoginController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    public ResponseEntity<UserResponseModel> createUser(@Valid @RequestBody CreateUserRequestModel requestModel) {
        ModelMapper modelMapper = new ModelMapper();
        UserDto userDto = modelMapper.map(requestModel, UserDto.class);

        UserDto createdUserDetails = userService.createUser(userDto);

        UserResponseModel returnValue = modelMapper.map(createdUserDetails, UserResponseModel.class);
        log.info("User created with id: " + returnValue.getUserId());

        return ResponseEntity.status(HttpStatus.CREATED).body(returnValue);
    }

    @GetMapping("/get-user/{username}")
    public ResponseEntity<String> getUserId(@PathVariable("username") String username) {

        UserDto createdUserDetails = userService.getUserByUsername(username);

        UserResponseModel returnValue = new ModelMapper().map(createdUserDetails, UserResponseModel.class);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(returnValue.getUserId());
    }

    @GetMapping("/{userId}")
    @PostAuthorize("principal == returnObject.body.userId")
    public ResponseEntity<UserResponseModel> getUser(@PathVariable("userId") String userId,
                                                     @RequestHeader("Authorization") String authorization,
                                                     @RequestParam(value = "fields", required = false) String fields) {

        UserDto userDto = userService.getUserByUserId(userId);

        UserResponseModel returnValue = new ModelMapper().map(userDto, UserResponseModel.class);

        // Include albums if requested
        if (fields != null) {
            String[] includeFields = fields.split(",");
            for (String field : includeFields) {
                if (field.trim().equalsIgnoreCase("orders")) {
                    List<OrderResponseModel> orders = userService.getUserOrders(authorization);
                    returnValue.setOrders(orders);
                    break;
                }
            }
        }

        return ResponseEntity.status(HttpStatus.OK).body(returnValue);
    }
}
