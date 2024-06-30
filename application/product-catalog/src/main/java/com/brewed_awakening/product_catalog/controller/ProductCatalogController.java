package com.brewed_awakening.product_catalog.controller;

import com.brewed_awakening.product_catalog.dto.ProductItem;
import com.brewed_awakening.product_catalog.repository.ProductItemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/product-catalog/")
public class ProductCatalogController {
    private final ProductItemRepository productItemRepository;

    @Autowired
    public ProductCatalogController(ProductItemRepository productItemRepository) {
        this.productItemRepository = productItemRepository;

    }

    @GetMapping("/product-list")
    public List<ProductItem> getProductList() {
        List<ProductItem> productItems = productItemRepository.findAll();

        return productItems;
    }

    @PostMapping("/saveItem")
    public ProductItem saveProductItem(@RequestBody ProductItem productItem){
        return productItemRepository.save(productItem);
    }

    @GetMapping("/{productId}")
    public ProductItem getProduct(@PathVariable("productId") long productId){
        return productItemRepository.findById(productId);
    }

    @GetMapping("/products")
    public List<ProductItem> getProductsByIds(@RequestParam List<Long> ids) {
        return productItemRepository.findAllById(ids);
    }
}