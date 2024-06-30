package com.brewed_awakening.order_service.dto;

public class ProductResponseModel {

   private Long id;

   private String productName;

   private Double productPrice;

   private String productDescription;

   private int productCalories;

   private String imageUrl;

   public ProductResponseModel(){}

   public ProductResponseModel(Long id, String productName, Double productPrice, String productDescription, int productCalories, String imageUrl) {
      this.id = id;
      this.productName = productName;
      this.productPrice = productPrice;
      this.productDescription = productDescription;
      this.productCalories = productCalories;
      this.imageUrl = imageUrl;
   }

   public Long getId() {
      return id;
   }

   public void setId(Long id) {
      this.id = id;
   }

   public String getProductName() {
      return productName;
   }

   public void setProductName(String productName) {
      this.productName = productName;
   }

   public Double getProductPrice() {
      return productPrice;
   }

   public void setProductPrice(Double productPrice) {
      this.productPrice = productPrice;
   }

   public String getProductDescription() {
      return productDescription;
   }

   public void setProductDescription(String productDescription) {
      this.productDescription = productDescription;
   }

   public int getProductCalories() {
      return productCalories;
   }

   public void setProductCalories(int productCalories) {
      this.productCalories = productCalories;
   }

   public String getImageUrl() {
      return imageUrl;
   }

   public void setImageUrl(String imageUrl) {
      this.imageUrl = imageUrl;
   }
}
