package com.brewed_awakening.user_service.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class AppProperties {

    @Autowired
    private Environment environment;

    public String getPropertry(String key) {
        return environment.getProperty(key);
    }
}
