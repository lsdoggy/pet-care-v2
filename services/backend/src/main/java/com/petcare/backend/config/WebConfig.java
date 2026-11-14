package com.petcare.backend.config;

import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final Path recordsDir;

    public WebConfig(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.recordsDir = Path.of(uploadDir).toAbsolutePath().normalize().resolve("records");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/files/records/**")
                .addResourceLocations(recordsDir.toUri().toString());
    }
}
