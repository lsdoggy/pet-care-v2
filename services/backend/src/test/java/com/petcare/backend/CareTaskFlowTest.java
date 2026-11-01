package com.petcare.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class CareTaskFlowTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    private String uniqueEmail() {
        return "taskuser" + System.nanoTime() + "@example.com";
    }

    private String registerAndLogin(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("email", email, "password", "Secret123!"))))
                .andExpect(status().isCreated());
        String loginBody = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("email", email, "password", "Secret123!"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(loginBody).get("accessToken").asText();
    }

    private long createPet(String token, String name) throws Exception {
        String body = mockMvc.perform(post("/api/v1/pets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("name", name, "species", "DOG"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(body).get("id").asLong();
    }

    private long createTask(String token, long petId, String title, String type,
                            Instant dueAt, String recurrenceRule) throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("petId", petId);
        payload.put("title", title);
        payload.put("type", type);
        payload.put("dueAt", dueAt.toString());
        if (recurrenceRule != null) {
            payload.put("recurrenceRule", recurrenceRule);
        }
        String body = mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(body).get("id").asLong();
    }

    @Test
    void crudFlowWithUpcomingOrdering() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long petId = createPet(token, "Rex");

        Instant now = Instant.now();
        long later = createTask(token, petId, "Feed Rex", "FOOD", now.plus(2, ChronoUnit.DAYS), null);
        long sooner = createTask(token, petId, "Vet visit", "VET", now.plus(1, ChronoUnit.HOURS), null);

        // GET /tasks/upcoming -> pending only, due_at ASC.
        mockMvc.perform(get("/api/v1/tasks/upcoming").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(sooner))
                .andExpect(jsonPath("$[0].petName").value("Rex"))
                .andExpect(jsonPath("$[1].id").value(later));

        // GET single task.
        mockMvc.perform(get("/api/v1/tasks/" + sooner).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Vet visit"))
                .andExpect(jsonPath("$.type").value("VET"));

        // PATCH: rename only.
        mockMvc.perform(patch("/api/v1/tasks/" + sooner)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("title", "Vet checkup"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Vet checkup"))
                .andExpect(jsonPath("$.type").value("VET"));

        // Complete without recurrence -> status DONE, disappears from upcoming.
        mockMvc.perform(post("/api/v1/tasks/" + sooner + "/complete").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));

        mockMvc.perform(get("/api/v1/tasks/upcoming").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(later))
                .andExpect(jsonPath("$[1]").doesNotExist());

        // DELETE -> 204, then 404.
        mockMvc.perform(delete("/api/v1/tasks/" + later).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/tasks/" + later).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void completeWithMonthlyRecurrenceCreatesNextTask() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long petId = createPet(token, "Luna");

        Instant dueAt = Instant.parse("2026-03-15T10:30:00Z");
        long id = createTask(token, petId, "Rabies vaccine", "VACCINATION", dueAt, "MONTHLY:1");

        String body = mockMvc.perform(post("/api/v1/tasks/" + id + "/complete")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        var next = JSON.readTree(body);
        // The response is the NEW recurring task: pending, same fields, due_at +1 month (UTC preserved).
        org.junit.jupiter.api.Assertions.assertNotEquals(id, next.get("id").asLong());
        org.junit.jupiter.api.Assertions.assertEquals("PENDING", next.get("status").asText());
        org.junit.jupiter.api.Assertions.assertEquals("2026-04-15T10:30:00Z", next.get("dueAt").asText());
        org.junit.jupiter.api.Assertions.assertEquals("MONTHLY:1", next.get("recurrenceRule").asText());
        org.junit.jupiter.api.Assertions.assertEquals("Rabies vaccine", next.get("title").asText());

        // Original task is DONE and both exist in full list; upcoming contains only the new one.
        mockMvc.perform(get("/api/v1/tasks/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));

        mockMvc.perform(get("/api/v1/tasks").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        mockMvc.perform(get("/api/v1/tasks/upcoming").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("PENDING"));
    }

    @Test
    void weeklyRecurrenceShiftsByWeeks() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long petId = createPet(token, "Bobik");

        long id = createTask(token, petId, "Grooming", "GROOMING",
                Instant.parse("2026-05-01T08:00:00Z"), "WEEKLY:2");

        String body = mockMvc.perform(post("/api/v1/tasks/" + id + "/complete")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        org.junit.jupiter.api.Assertions.assertEquals(
                "2026-05-15T08:00:00Z", JSON.readTree(body).get("dueAt").asText());
    }

    @Test
    void validationRejectsBadPayloads() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long petId = createPet(token, "Simba");

        // Blank title.
        mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", petId, "title", "", "type", "FOOD",
                                "dueAt", Instant.now().plusSeconds(3600).toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.details[0].field").value("title"));

        // Past due date.
        mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", petId, "title", "Old", "type", "FOOD",
                                "dueAt", Instant.now().minusSeconds(3600).toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details[0].field").value("dueAt"));

        // Malformed recurrence rule.
        mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", petId, "title", "Trim nails", "type", "GROOMING",
                                "dueAt", Instant.now().plusSeconds(3600).toString(),
                                "recurrenceRule", "EVERYDAY:oops"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details[0].field").value("recurrenceRule"));

        // Non-existent pet.
        mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", 999_999_999L, "title", "Ghost food", "type", "FOOD",
                                "dueAt", Instant.now().plusSeconds(3600).toString()))))
                .andExpect(status().isNotFound());
    }

    @Test
    void otherUsersCannotTouchForeignTask() throws Exception {
        String ownerToken = registerAndLogin(uniqueEmail());
        String strangerToken = registerAndLogin(uniqueEmail());
        long petId = createPet(ownerToken, "Shadow");

        long id = createTask(ownerToken, petId, "Walk Shadow", "WALK",
                Instant.now().plus(1, ChronoUnit.DAYS), "DAILY:1");

        mockMvc.perform(get("/api/v1/tasks/" + id).header("Authorization", "Bearer " + strangerToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/tasks/" + id + "/complete").header("Authorization", "Bearer " + strangerToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(patch("/api/v1/tasks/" + id)
                        .header("Authorization", "Bearer " + strangerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("title", "Hijacked"))))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/tasks/" + id).header("Authorization", "Bearer " + strangerToken))
                .andExpect(status().isNotFound());

        // Stranger's upcoming list must not contain the foreign task.
        mockMvc.perform(get("/api/v1/tasks/upcoming").header("Authorization", "Bearer " + strangerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").doesNotExist());

        // Owner still sees it intact.
        mockMvc.perform(get("/api/v1/tasks/" + id).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Walk Shadow"));
    }

    @Test
    void cannotCreateTaskForForeignPet() throws Exception {
        String ownerToken = registerAndLogin(uniqueEmail());
        String strangerToken = registerAndLogin(uniqueEmail());
        long petId = createPet(ownerToken, "Guard");

        mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", "Bearer " + strangerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", petId, "title", "Intruder food", "type", "FOOD",
                                "dueAt", Instant.now().plusSeconds(3600).toString()))))
                .andExpect(status().isNotFound());
    }

    @Test
    void unauthenticatedRequestsAreRejected() throws Exception {
        mockMvc.perform(get("/api/v1/tasks")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/tasks/upcoming")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"petId\":1,\"title\":\"X\",\"type\":\"FOOD\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/tasks/1/complete")).andExpect(status().isUnauthorized());
    }
}
