package com.brewed_awakening.product_catalog.service;

//import com.amazonaws.services.s3.AmazonS3;
//import com.amazonaws.services.s3.model.PutObjectRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class S3Service {

//    private final AmazonS3 s3Client;
//    private final String bucketName;
//
//    public S3Service(AmazonS3 s3Client, @Value("${aws.s3.bucket-name}") String bucketName) {
//        this.s3Client = s3Client;
//        this.bucketName = bucketName;
//    }
//
//    public String uploadFile(MultipartFile file) throws java.io.IOException {
//        String fileName = System.currentTimeMillis() + "_" + file.getOriginalFilename();
//        s3Client.putObject(new PutObjectRequest(bucketName, fileName, file.getInputStream(), null));
//        return s3Client.getUrl(bucketName, fileName).toString();
//    }
}
