package com.brewed_awakening.user_service.data;

import com.brewed_awakening.user_service.domain.AppUser;
import org.springframework.data.repository.CrudRepository;

import java.util.Optional;

public interface AppUserRepository extends CrudRepository<AppUser, Long> {
    AppUser findByUsername(String username);
    AppUser findByUserId(String userId);
}
