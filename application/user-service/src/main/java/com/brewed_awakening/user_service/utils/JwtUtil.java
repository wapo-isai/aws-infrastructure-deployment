package com.brewed_awakening.user_service.utils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import javax.crypto.spec.SecretKeySpec;
import java.security.Key;
import java.util.Base64;

@Component
public class JwtUtil {
    Environment environment;

    public JwtUtil(Environment environment) {
        this.environment = environment;
    }

    public String getUserId(String header) {
        String token = header.replace(environment.getProperty("authorization.token.header.prefix"), "");

        byte[] decodedKey = Base64.getDecoder().decode(environment.getProperty("token.secret"));

        Key key = new SecretKeySpec(decodedKey, 0, decodedKey.length, "HmacSHA256");

        Claims claims = Jwts.parserBuilder().setSigningKey(key).build()
                .parseClaimsJws(token).getBody();

        if (claims == null) {
            return null;
        }

        return (String) claims.get("userId");
    }
}
