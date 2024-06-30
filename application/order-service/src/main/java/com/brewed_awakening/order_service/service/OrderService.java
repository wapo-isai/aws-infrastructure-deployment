package com.brewed_awakening.order_service.service;

import com.brewed_awakening.order_service.dto.Order;
import com.brewed_awakening.order_service.dto.ProductResponseModel;

import java.util.List;

public interface OrderService {
    List<Order> getOrders(String userId);
    Order createOrder(Order order);

//    List<ProductResponseModel> getProducts(List<Long> productIds);
}
