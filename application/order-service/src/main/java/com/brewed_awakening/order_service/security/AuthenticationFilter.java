package com.brewed_awakening.order_service.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import io.jsonwebtoken.Jwts;
import org.springframework.core.env.Environment;
import java.security.Key;

import javax.crypto.spec.SecretKeySpec;

import java.io.IOException;
import java.util.Base64;

public class AuthenticationFilter extends BasicAuthenticationFilter {

    Environment environment;

    public AuthenticationFilter(AuthenticationManager authManager, Environment environment) {
        super(authManager);

        this.environment = environment;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws IOException, ServletException {

        String jws = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (jws != null) {
            String token = jws.replace(environment.getProperty("authorization.token.header.prefix"), "");

            byte[] decodedKey = Base64.getDecoder().decode(environment.getProperty("token.secret"));

            Key key = new SecretKeySpec(decodedKey, 0, decodedKey.length, "HmacSHA256");

            String userId = Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token)
                    .getBody()
                    .getSubject();

            Authentication authentication = new UsernamePasswordAuthenticationToken(userId, null, java.util.Collections.emptyList());

            SecurityContextHolder.getContext().setAuthentication(authentication);

            filterChain.doFilter(request, response);
        }

        else {
            filterChain.doFilter(request, response);
            return;
        }

    }
}
