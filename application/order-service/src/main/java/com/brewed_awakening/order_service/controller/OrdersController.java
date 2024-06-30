package com.brewed_awakening.order_service.controller;

import com.brewed_awakening.order_service.dto.Order;
import com.brewed_awakening.order_service.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PostAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/orders")
public class OrdersController {

    @Autowired
    OrderService orderService;

    @GetMapping
    @PostAuthorize("(returnObject.size() > 0) ? principal == returnObject[0].userId : true")
    public List<Order> getOrders(Principal principal) {
        return orderService.getOrders(principal.getName());
    }

    @PostMapping
    public Order createOrder(@RequestBody Order order, Principal principal) {
        order.setUserId(principal.getName());
        return orderService.createOrder(order);
    }
}
