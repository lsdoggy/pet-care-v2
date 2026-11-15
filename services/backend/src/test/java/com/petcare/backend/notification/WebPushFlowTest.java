package com.petcare.backend.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.device.UserDeviceEntity;
import com.petcare.backend.device.UserDeviceRepository;
import com.petcare.backend.security.JwtService;
import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;

@SpringBootTest
@AutoConfigureMockMvc
class WebPushFlowTest {

    private static final String BASE_PATH = "/api/v1/web-push";

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    @Autowired WebPushSubscriptions subscriptions;
    @Autowired NotificationRepository notifications;

    @MockitoBean WebPushTransport transport;

    @Test
    void bindingIsIdempotentAndIsolatedByOwner() throws Exception {
        when(transport.enabled()).thenReturn(true);
        UserEntity owner = createUser();
        UserEntity stranger = createUser();
        String endpoint = newEndpoint();

        mvc.perform(put(BASE_PATH + "/subscription").contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"" + endpoint + "\"}")).andExpect(status().isUnauthorized());
        mvc.perform(request(put(BASE_PATH + "/subscription"), owner, "https://web.push.apple.com.example.test/slot"))
                .andExpect(status().isBadRequest());
        mvc.perform(request(put(BASE_PATH + "/subscription"), owner, endpoint)).andExpect(status().isNoContent());
        mvc.perform(request(put(BASE_PATH + "/subscription"), owner, endpoint)).andExpect(status().isNoContent());
        mvc.perform(request(put(BASE_PATH + "/subscription"), stranger, endpoint)).andExpect(status().isNotFound());
        mvc.perform(request(delete(BASE_PATH + "/subscription"), stranger, endpoint)).andExpect(status().isNoContent());
        mvc.perform(request(post(BASE_PATH + "/status"), stranger, endpoint))
                .andExpect(status().isOk()).andExpect(jsonPath("$.subscribed").value(false));
        mvc.perform(request(post(BASE_PATH + "/status"), owner, endpoint))
                .andExpect(status().isOk()).andExpect(jsonPath("$.subscribed").value(true));

        mvc.perform(request(delete(BASE_PATH + "/subscription"), owner, endpoint)).andExpect(status().isNoContent());
        assertThat(subscriptions.deliver(owner.getId(), Instant.now()).attempted()).isFalse();
        verify(transport, never()).send(anyString());
    }

    @Test
    @Transactional
    void sharedFanOutUsesNativeSenderAndWebPushIndependently() throws Exception {
        when(transport.enabled()).thenReturn(true);
        UserEntity owner = createUser();
        String endpoint = newEndpoint();
        String expired = newEndpoint();
        String nativeToken = "ExponentPushToken[fixture]";
        subscriptions.subscribe(owner.getEmail(), endpoint);
        subscriptions.subscribe(owner.getEmail(), expired);
        when(transport.send(endpoint)).thenReturn(201);
        when(transport.send(expired)).thenReturn(410);

        var devices = mock(UserDeviceRepository.class);
        var nativeDevice = mock(UserDeviceEntity.class);
        when(devices.findByUserIdAndPushEnabledTrue(owner.getId())).thenReturn(List.of(nativeDevice));
        when(nativeDevice.getToken()).thenReturn(nativeToken);
        var nativeSender = mock(PushSender.class);
        when(nativeSender.supports(nativeToken)).thenReturn(true);
        when(nativeSender.send(eq(List.of(nativeToken)), anyString(), anyString(), anyString()))
                .thenReturn(List.of(nativeToken));
        var service = new NotificationService(notifications, devices, users, List.of(nativeSender),
                mock(MailSender.class), subscriptions);

        String title = "Internal test reminder";
        service.push(owner, title, "Private test subject", Map.of("petId", 123));
        service.push(owner, title, "Private test subject", Map.of("petId", 123));

        verify(nativeSender, times(2))
                .send(eq(List.of(nativeToken)), eq(title), eq("Private test subject"), anyString());
        verify(transport).send(expired);
        verify(transport, times(2)).send(endpoint);
        assertThat(subscriptions.isSubscribed(owner.getEmail(), expired)).isFalse();
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(owner.getId()))
                .hasSize(2).allMatch(row -> row.getChannelStatus() == ChannelStatus.SENT);
    }

    private UserEntity createUser() {
        return users.save(new UserEntity(UUID.randomUUID() + "@example.test", "unused", null, null));
    }

    private MockHttpServletRequestBuilder request(MockHttpServletRequestBuilder builder, UserEntity user, String endpoint) {
        return builder.header("Authorization", "Bearer " + jwt.generateToken(user))
                .contentType(MediaType.APPLICATION_JSON).content("{\"endpoint\":\"" + endpoint + "\"}");
    }

    private String newEndpoint() {
        return "https://web.push.apple.com/" + UUID.randomUUID();
    }
}
