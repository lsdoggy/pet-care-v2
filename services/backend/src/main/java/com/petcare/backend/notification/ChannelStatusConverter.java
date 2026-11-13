package com.petcare.backend.notification;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class ChannelStatusConverter implements AttributeConverter<ChannelStatus, String> {

    @Override
    public String convertToDatabaseColumn(ChannelStatus value) {
        return value == null ? null : value.getValue();
    }

    @Override
    public ChannelStatus convertToEntityAttribute(String value) {
        return value == null ? null : ChannelStatus.fromValue(value);
    }
}
