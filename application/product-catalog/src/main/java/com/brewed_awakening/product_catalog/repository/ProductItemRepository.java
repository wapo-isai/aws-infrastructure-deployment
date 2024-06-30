package com.brewed_awakening.product_catalog.repository;

import com.brewed_awakening.product_catalog.dto.ProductItem;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductItemRepository extends JpaRepository<ProductItem, Long> {
    ProductItem findById(long id);
    List<ProductItem> findAllById(Iterable<Long> ids);
}
