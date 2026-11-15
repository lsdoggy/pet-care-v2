package com.petcare.backend;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petcare.backend.notification.MailSender;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.convention.TestBean;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.account.password-reset-page=https://petcare.example/reset-password",
        "app.account.recovery-page=https://petcare.example/restore-account"
})
@AutoConfigureMockMvc
class PasswordResetFlowTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String OLD_PASSWORD = "Secret123!";
    private static final String NEW_PASSWORD = "Secret456!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @MockitoBean
    private MailSender mailSender;

    @TestBean(name = "accessLinkExecutor")
    private TaskExecutor accessLinkExecutor;

    static TaskExecutor accessLinkExecutor() {
        return new SyncTaskExecutor();
    }

    @Test
    void passwordResetUsesSeparateOneTimeTokenAndRevokesExistingSessions() throws Exception {
        String email = uniqueEmail();
        String jwt = register(email);
        when(mailSender.send(eq(email), anyString(), anyString())).thenReturn(true);

        mockMvc.perform(requestLink(email)).andExpect(status().isNoContent()).andExpect(content().string(""));
        mockMvc.perform(requestLink(uniqueEmail())).andExpect(status().isNoContent()).andExpect(content().string(""));
        String token = capturedToken(email);
        mockMvc.perform(authPost("/restore-account", Map.of("token", token))).andExpect(status().isBadRequest());
        mockMvc.perform(reset(token)).andExpect(status().isNoContent());
        mockMvc.perform(reset(token)).andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + jwt))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(login(email, OLD_PASSWORD)).andExpect(status().isUnauthorized());
        mockMvc.perform(login(email, NEW_PASSWORD)).andExpect(status().isOk());
    }

    @Test
    void expiredResetLinkAndFailedReplacementDoNotChangeCredentials() throws Exception {
        String email = uniqueEmail();
        register(email);
        when(mailSender.send(eq(email), anyString(), anyString())).thenReturn(true);
        mockMvc.perform(requestLink(email)).andExpect(status().isNoContent());
        String token = capturedToken(email);
        jdbc.update("update users set password_reset_token_expires_at = ? where email = ?",
                Timestamp.from(Instant.now().minusSeconds(1)), email);

        when(mailSender.send(eq(email), anyString(), anyString())).thenReturn(false);
        mockMvc.perform(requestLink(email)).andExpect(status().isNoContent()).andExpect(content().string(""));
        mockMvc.perform(reset(token)).andExpect(status().isBadRequest());
        mockMvc.perform(login(email, OLD_PASSWORD)).andExpect(status().isOk());
    }

    @Test
    void failedRecoveryEmailKeepsAccountActive() throws Exception {
        String email = uniqueEmail();
        String jwt = register(email);
        when(mailSender.send(eq(email), anyString(), anyString())).thenReturn(false);

        mockMvc.perform(post("/api/v1/users/me/deactivate").header("Authorization", "Bearer " + jwt))
                .andExpect(status().isServiceUnavailable());
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk());
    }

    @Test
    void deactivatedAccountCanReplaceItsExpiredRecoveryLink() throws Exception {
        String email = uniqueEmail();
        String jwt = register(email);
        when(mailSender.send(eq(email), eq("Восстановление аккаунта Pet Care"), anyString())).thenReturn(true);
        mockMvc.perform(post("/api/v1/users/me/deactivate").header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNoContent());
        String oldToken = capturedToken(email);
        jdbc.update("update users set recovery_token_expires_at = ? where email = ?",
                Timestamp.from(Instant.now().minusSeconds(1)), email);
        mockMvc.perform(authPost("/restore-account", Map.of("token", oldToken))).andExpect(status().isBadRequest());

        mockMvc.perform(requestLink(email)).andExpect(status().isNoContent());
        var body = ArgumentCaptor.forClass(String.class);
        verify(mailSender, org.mockito.Mockito.times(2))
                .send(eq(email), eq("Восстановление аккаунта Pet Care"), body.capture());
        String token = body.getValue().split("#", 2)[1];
        mockMvc.perform(reset(token)).andExpect(status().isBadRequest());
        mockMvc.perform(authPost("/restore-account", Map.of("token", token))).andExpect(status().isNoContent());
        mockMvc.perform(authPost("/restore-account", Map.of("token", token))).andExpect(status().isBadRequest());
        mockMvc.perform(login(email, OLD_PASSWORD)).andExpect(status().isOk());
    }

    private String capturedToken(String email) {
        var body = ArgumentCaptor.forClass(String.class);
        verify(mailSender).send(eq(email), anyString(), body.capture());
        return body.getValue().split("#", 2)[1];
    }

    private String register(String email) throws Exception {
        String response = mockMvc.perform(authPost("/register", Map.of(
                        "email", email, "password", OLD_PASSWORD, "inviteCode", TestInvites.issue(jdbc))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(response).get("accessToken").asText();
    }

    private String uniqueEmail() {
        return "reset-" + System.nanoTime() + "@example.com";
    }

    private MockHttpServletRequestBuilder requestLink(String email) throws Exception {
        return authPost("/request-access-link", Map.of("email", email));
    }

    private MockHttpServletRequestBuilder reset(String token) throws Exception {
        return authPost("/reset-password", Map.of("token", token, "password", NEW_PASSWORD));
    }

    private MockHttpServletRequestBuilder login(String email, String password) throws Exception {
        return authPost("/login", Map.of("email", email, "password", password));
    }

    private MockHttpServletRequestBuilder authPost(String path, Map<String, String> data) throws Exception {
        return post("/api/v1/auth" + path)
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.writeValueAsString(data));
    }
}
