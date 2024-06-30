package com.brewed_awakening.order_service.data;

import org.springframework.data.repository.CrudRepository;

import java.util.List;

public interface OrderRepository extends CrudRepository<OrderEntity, Long> {
    List<OrderEntity> findAllByUserId(String userId);
}
