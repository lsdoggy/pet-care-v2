package com.petcare.backend.notification;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class NotificationTypeConverter implements AttributeConverter<NotificationType, String> {

    @Override
    public String convertToDatabaseColumn(NotificationType value) {
        return value == null ? null : value.getValue();
    }

    @Override
    public NotificationType convertToEntityAttribute(String value) {
        return value == null ? null : NotificationType.fromValue(value);
    }
}
