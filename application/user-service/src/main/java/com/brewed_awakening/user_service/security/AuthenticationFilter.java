package com.brewed_awakening.user_service.security;

import com.brewed_awakening.user_service.domain.LoginRequestModel;
import com.brewed_awakening.user_service.domain.UserDto;
import com.brewed_awakening.user_service.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.env.Environment;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.core.userdetails.User;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Date;

public class AuthenticationFilter extends UsernamePasswordAuthenticationFilter {
    private final Environment environment;
    private final UserService usersService;

    public AuthenticationFilter(Environment environment, AuthenticationManager authenticationManager,
                                UserService usersService) {
        this.environment = environment;
        this.usersService = usersService;
        super.setAuthenticationManager(authenticationManager);
    }

    @Override
    public Authentication attemptAuthentication(HttpServletRequest req, HttpServletResponse res)
            throws AuthenticationException {
        try {

            LoginRequestModel creds = new ObjectMapper().readValue(req.getInputStream(), LoginRequestModel.class);

            return getAuthenticationManager().authenticate(
                    new UsernamePasswordAuthenticationToken(creds.getUsername(), creds.getPassword(), new ArrayList<>()));

        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    protected void successfulAuthentication(HttpServletRequest req, HttpServletResponse res, FilterChain chain,
                                            Authentication auth) throws IOException, ServletException {

        // Get User Details from Database
        String userName = ((User) auth.getPrincipal()).getUsername();
        UserDto userDto = usersService.getUserByUsername(userName);

        // Generate JWT
        Claims claims = Jwts.claims();
        claims.put("userName", userDto.getUsername());

        String token = Jwts.builder()
//                 .setClaims(claims)
                .setSubject(userDto.getUserId())
                .setExpiration(new Date(
                        System.currentTimeMillis() + Long.parseLong(environment.getProperty("token.expiration_time"))))
                .signWith(SignatureAlgorithm.HS256, environment.getProperty("token.secret")).compact();

        res.addHeader("Token", token);
        res.addHeader("UserID", userDto.getUserId());

    }
}
