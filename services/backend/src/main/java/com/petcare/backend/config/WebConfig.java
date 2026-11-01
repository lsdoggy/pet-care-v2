package com.petcare.backend.config;

import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves uploaded files (./uploads/...) over HTTP at /files/uploads/...
 * Example: ./uploads/pets/abc.jpg  ->  GET /files/uploads/pets/abc.jpg
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final Path uploadRoot;

    public WebConfig(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/files/uploads/**")
                .addResourceLocations(uploadRoot.toUri().toString());
    }
}
