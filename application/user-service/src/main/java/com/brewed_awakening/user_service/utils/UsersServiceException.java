package com.brewed_awakening.user_service.utils;

public class UsersServiceException extends RuntimeException {

    public UsersServiceException(){}

    public UsersServiceException(String message)
    {
        super(message);
    }

}
