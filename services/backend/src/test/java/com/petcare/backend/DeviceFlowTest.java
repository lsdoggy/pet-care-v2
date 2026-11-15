package com.petcare.backend;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DeviceFlowTest {

    private static final String DEVICES = "/api/v1/devices";
    private final ObjectMapper json = new ObjectMapper();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void registrationTransfersInstallationAndOldOwnerCannotUnregisterIt() throws Exception {
        String first = registerUser();
        String next = registerUser();
        String token = "ExponentPushToken[" + UUID.randomUUID() + "]";

        long id = registerDevice(first, token);
        assertEquals(id, registerDevice(first, token));
        assertEquals(id, registerDevice(next, token));

        mvc.perform(get(DEVICES).header("Authorization", "Bearer " + first))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete(DEVICES + "/" + id).header("Authorization", "Bearer " + first))
                .andExpect(status().isNotFound());
        mvc.perform(delete(DEVICES + "/" + id).header("Authorization", "Bearer " + next))
                .andExpect(status().isNoContent());
        mvc.perform(get(DEVICES).header("Authorization", "Bearer " + next))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void simultaneousFirstRegistrationsReturnTheSameDevice() throws Exception {
        String first = registerUser();
        String next = registerUser();
        String token = "ExponentPushToken[" + UUID.randomUUID() + "]";
        var start = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var firstId = executor.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                return registerDevice(first, token);
            });
            var nextId = executor.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                return registerDevice(next, token);
            });
            assertEquals(firstId.get(20, TimeUnit.SECONDS), nextId.get(20, TimeUnit.SECONDS));
        }
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM user_devices WHERE token = ?",
                Integer.class, token));
    }

    private long registerDevice(String jwt, String token) throws Exception {
        String result = mvc.perform(post(DEVICES + "/register")
                        .header("Authorization", "Bearer " + jwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("token", token, "platform", "android"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(result).path("id").asLong();
    }

    private String registerUser() throws Exception {
        String response = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("inviteCode", TestInvites.issue(jdbc),
                                "email", UUID.randomUUID() + "@example.test", "password", "Secret123!"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).path("accessToken").asText();
    }
}
