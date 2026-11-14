package com.petcare.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Sprint 4: Veterinary Appointments & Records — CRUD, ownership isolation,
 * merged per-pet history and record attachment upload.
 */
@SpringBootTest(properties = {
        "petcare.vetinfo.token=clinic-integration-test-token-only",
        "petcare.vetinfo.pet-id=9223372036854775807",
        "petcare.vetinfo.clinic-name=Test Clinic"
})
@AutoConfigureMockMvc
class VetFlowTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    private String uniqueEmail() {
        return "vetuser" + System.nanoTime() + "@example.com";
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

    private long createAppointment(String token, long petId, Instant scheduledAt) throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("petId", petId);
        payload.put("clinicName", "CityVet Clinic");
        payload.put("doctorName", "Dr. House");
        payload.put("scheduledAt", scheduledAt.toString());
        payload.put("durationMinutes", 45);
        payload.put("cost", 45.50);
        payload.put("currency", "usd");
        payload.put("reason", "  Annual checkup  ");
        String body = mockMvc.perform(post("/api/v1/appointments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.durationMinutes").value(45))
                .andExpect(jsonPath("$.reason").value("Annual checkup"))
                .andExpect(jsonPath("$.currency").value("USD")) // normalized to uppercase
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(body).get("id").asLong();
    }

    private long createRecord(String token, long petId, LocalDate visitDate, Long appointmentId) throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("petId", petId);
        payload.put("visitDate", visitDate.toString());
        payload.put("diagnosisText", "Ear infection");
        if (appointmentId != null) {
            payload.put("appointmentId", appointmentId);
        }
        String body = mockMvc.perform(post("/api/v1/records")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attachments").isArray())
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(body).get("id").asLong();
    }

    @Test
    void clinicIntakeRequiresScopedTokenAndValidJson() throws Exception {
        String clinicAuthorization = "Bearer clinic-integration-test-token-only";
        String userToken = registerAndLogin(uniqueEmail());
        String body = JSON.writeValueAsString(Map.of("scheduledAt", Instant.now().plusSeconds(3600).toString()));

        mockMvc.perform(post("/api/v1/vetinfo").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/vetinfo").header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/appointments").header("Authorization", clinicAuthorization))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/vetinfo").header("Authorization", clinicAuthorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/vetinfo").header("Authorization", clinicAuthorization)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void clinicVisitWithoutCostAppearsOnlyInConfiguredPetsHistory() throws Exception {
        String email = uniqueEmail();
        String ownerToken = registerAndLogin(email);
        String otherToken = registerAndLogin(uniqueEmail());
        long petId = Long.MAX_VALUE;
        jdbc.update("""
                INSERT INTO pets (id, owner_id, name, species)
                SELECT ?, id, 'Clinic patient', 'DOG' FROM users WHERE email = ?
                """, petId, email);

        String response = mockMvc.perform(post("/api/v1/vetinfo")
                        .header("Authorization", "Bearer clinic-integration-test-token-only")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "scheduledAt", Instant.now().plusSeconds(3600).toString(),
                                "reason", "Routine exam"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long appointmentId = JSON.readTree(response).get("appointmentId").asLong();

        mockMvc.perform(get("/api/v1/pets/" + petId + "/history")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].appointment.id").value(appointmentId))
                .andExpect(jsonPath("$[0].appointment.clinicName").value("Test Clinic"))
                .andExpect(jsonPath("$[0].appointment.reason").value("Routine exam"))
                .andExpect(jsonPath("$[0].appointment.status").value("SCHEDULED"))
                .andExpect(jsonPath("$[0].appointment.cost").doesNotExist());

        mockMvc.perform(get("/api/v1/appointments/" + appointmentId)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void appointmentCrudLifecycle() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long petId = createPet(token, "Rex");
        Instant when = Instant.now().plus(3, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);

        long id = createAppointment(token, petId, when);

        mockMvc.perform(get("/api/v1/appointments").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].petName").value("Rex"));

        mockMvc.perform(patch("/api/v1/appointments/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("status", "COMPLETED", "notes", "all good"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.notes").value("all good"))
                .andExpect(jsonPath("$.reason").value("Annual checkup"))
                .andExpect(jsonPath("$.clinicName").value("CityVet Clinic")); // untouched by PATCH

        mockMvc.perform(patch("/api/v1/appointments/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("reason", " "))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reason").doesNotExist());

        mockMvc.perform(delete("/api/v1/appointments/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/appointments/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void validationRejectsBadAppointment() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long petId = createPet(token, "Bobik");

        // missing clinicName + duration out of range
        mockMvc.perform(post("/api/v1/appointments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", petId,
                                "scheduledAt", Instant.now().toString(),
                                "durationMinutes", 900))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details").isArray());

        // appointment for a non-existent pet -> 404
        mockMvc.perform(post("/api/v1/appointments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", 999_999_999L,
                                "clinicName", "X",
                                "scheduledAt", Instant.now().toString()))))
                .andExpect(status().isNotFound());
    }

    @Test
    void recordsAreIsolatedBetweenOwners() throws Exception {
        String alice = registerAndLogin(uniqueEmail());
        String bob = registerAndLogin(uniqueEmail());
        long alicePet = createPet(alice, "Alice-dog");

        long recordId = createRecord(alice, alicePet, LocalDate.now(), null);

        mockMvc.perform(get("/api/v1/records/" + recordId).header("Authorization", "Bearer " + bob))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/records/" + recordId).header("Authorization", "Bearer " + bob))
                .andExpect(status().isNotFound());
        // still there for the owner
        mockMvc.perform(get("/api/v1/records/" + recordId).header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk());
    }

    @Test
    void recordCannotLinkForeignOrOtherPetsAppointment() throws Exception {
        String alice = registerAndLogin(uniqueEmail());
        String bob = registerAndLogin(uniqueEmail());
        long alicePet = createPet(alice, "A");
        long aliceOtherPet = createPet(alice, "B");
        long bobPet = createPet(bob, "C");

        long aliceAppt = createAppointment(alice, alicePet, Instant.now().plusSeconds(3600));
        long bobAppt = createAppointment(bob, bobPet, Instant.now().plusSeconds(3600));

        // foreign appointment -> treated as not found (404, no leak)
        mockMvc.perform(post("/api/v1/records")
                        .header("Authorization", "Bearer " + alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", alicePet,
                                "visitDate", LocalDate.now().toString(),
                                "appointmentId", bobAppt))))
                .andExpect(status().isNotFound());

        // own appointment but for another pet -> 403-ish handled as access denied (404)
        mockMvc.perform(post("/api/v1/records")
                        .header("Authorization", "Bearer " + alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "petId", aliceOtherPet,
                                "visitDate", LocalDate.now().toString(),
                                "appointmentId", aliceAppt))))
                .andExpect(status().isNotFound());

        // valid link works
        createRecord(alice, alicePet, LocalDate.now(), aliceAppt);
    }

    @Test
    void historyMergesAppointmentsAndRecordsNewestFirst() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long petId = createPet(token, "Timeline");

        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        createAppointment(token, petId, now.plus(10, ChronoUnit.DAYS));   // future appt
        createAppointment(token, petId, now.minus(10, ChronoUnit.DAYS));  // past appt
        createRecord(token, petId, LocalDate.now().minusDays(5), null);   // past record

        mockMvc.perform(get("/api/v1/pets/" + petId + "/history").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].kind").value("APPOINTMENT"))     // +10d first
                .andExpect(jsonPath("$[0].appointment").exists())
                .andExpect(jsonPath("$[0].record").doesNotExist())
                .andExpect(jsonPath("$[1].kind").value("RECORD"))          // -5d
                .andExpect(jsonPath("$[1].record.diagnosisText").value("Ear infection"))
                .andExpect(jsonPath("$[2].kind").value("APPOINTMENT"));    // -10d

        // other user cannot read someone else's pet history
        String intruder = registerAndLogin(uniqueEmail());
        mockMvc.perform(get("/api/v1/pets/" + petId + "/history").header("Authorization", "Bearer " + intruder))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletingAppointmentUnlinksRecordsButKeepsThem() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long petId = createPet(token, "unlink-me");
        long apptId = createAppointment(token, petId, Instant.now().plusSeconds(7200));
        long recordId = createRecord(token, petId, LocalDate.now(), apptId);

        mockMvc.perform(delete("/api/v1/appointments/" + apptId).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/records/" + recordId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appointmentId").doesNotExist());
    }

    @Test
    void keyedRecordCreationReplaysAndIsScopedToOwner() throws Exception {
        String alice = registerAndLogin(uniqueEmail());
        long alicePet = createPet(alice, "Alice pet");
        String bob = registerAndLogin(uniqueEmail());
        long bobPet = createPet(bob, "Bob pet");
        String key = "record-retry";

        String created = raceAndReplay(() -> keyedRecord(alice, alicePet, key, "Original"), 201);
        long id = JSON.readTree(created).get("id").asLong();
        mockMvc.perform(patch("/api/v1/records/" + id)
                        .header("Authorization", "Bearer " + alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"diagnosisText\":\"Updated\"}"))
                .andExpect(status().isOk());
        assertEquals(JSON.readTree(created),
                JSON.readTree(response(keyedRecord(alice, alicePet, key, "Original"), 201)));
        mockMvc.perform(keyedRecord(alice, alicePet, key, "Different"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Idempotency-Key was already used with different content"));
        mockMvc.perform(keyedRecord(alice, alicePet, "invalid key", "Original"))
                .andExpect(status().isBadRequest());

        String other = response(keyedRecord(bob, bobPet, key, "Original"), 201);
        assertNotEquals(id, JSON.readTree(other).get("id").asLong());
        mockMvc.perform(get("/api/v1/records").header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void keyedAttachmentReplaysAndDetectsChangedFileOrTarget() throws Exception {
        String alice = registerAndLogin(uniqueEmail());
        long alicePet = createPet(alice, "Alice pet");
        String key = "attachment-retry";
        long id = JSON.readTree(response(keyedRecord(alice, alicePet, key, "Diagnosis"), 201)).get("id").asLong();
        long anotherRecord = createRecord(alice, alicePet, LocalDate.now(), null);

        String attached = raceAndReplay(() -> keyedAttachment(alice, id, key, "test.pdf", (byte) 1), 200);
        assertEquals(1, JSON.readTree(attached).get("attachments").size());
        mockMvc.perform(keyedAttachment(alice, id, key, "test.pdf", (byte) 2))
                .andExpect(status().isConflict());
        mockMvc.perform(keyedAttachment(alice, id, key, "renamed.pdf", (byte) 1))
                .andExpect(status().isConflict());
        mockMvc.perform(keyedAttachment(alice, anotherRecord, key, "test.pdf", (byte) 1))
                .andExpect(status().isConflict());

        response(keyedAttachment(alice, id, "new-file", "test.pdf", (byte) 1), 200);
        assertEquals(JSON.readTree(attached),
                JSON.readTree(response(keyedAttachment(alice, id, key, "test.pdf", (byte) 1), 200)));
        mockMvc.perform(get("/api/v1/records/" + id).header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attachments.length()").value(2));

        String bob = registerAndLogin(uniqueEmail());
        long bobRecord = createRecord(bob, createPet(bob, "Bob pet"), LocalDate.now(), null);
        mockMvc.perform(keyedAttachment(bob, id, key, "test.pdf", (byte) 1))
                .andExpect(status().isNotFound());
        mockMvc.perform(keyedAttachment(bob, bobRecord, key, "test.pdf", (byte) 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attachments.length()").value(1));
    }

    private RequestBuilder keyedRecord(String token, long petId, String key, String diagnosis) throws Exception {
        return post("/api/v1/records")
                .header("Authorization", "Bearer " + token)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.writeValueAsString(Map.of(
                        "petId", petId, "visitDate", LocalDate.now().toString(), "diagnosisText", diagnosis)));
    }

    private RequestBuilder keyedAttachment(String token, long id, String key, String name, byte content) {
        return multipart("/api/v1/records/" + id + "/attachments")
                .file(new MockMultipartFile("file", name, "application/pdf", new byte[] {content}))
                .header("Authorization", "Bearer " + token)
                .header("Idempotency-Key", key);
    }

    private String raceAndReplay(Callable<RequestBuilder> request, int expectedStatus) throws Exception {
        var start = new CyclicBarrier(2);
        Callable<String> submit = () -> {
            RequestBuilder prepared = request.call();
            start.await(10, TimeUnit.SECONDS);
            return response(prepared, expectedStatus);
        };
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(submit);
            var second = executor.submit(submit);
            String original = first.get(20, TimeUnit.SECONDS);
            assertEquals(JSON.readTree(original), JSON.readTree(second.get(20, TimeUnit.SECONDS)));
            return original;
        }
    }

    private String response(RequestBuilder request, int expectedStatus) throws Exception {
        return mockMvc.perform(request).andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void uploadAttachmentAppendsToJsonbAndRejectsBadTypes() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long petId = createPet(token, "Doc-muncher");
        long recordId = createRecord(token, petId, LocalDate.now(), null);

        MockMultipartFile pdf = new MockMultipartFile(
                "file", "blood-test.pdf", "application/pdf", "%PDF-1.4 fake".getBytes());

        mockMvc.perform(multipart("/api/v1/records/" + recordId + "/attachments").file(pdf)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attachments.length()").value(1))
                .andExpect(jsonPath("$.attachments[0].name").value("blood-test.pdf"))
                .andExpect(jsonPath("$.attachments[0].type").value("pdf"))
                .andExpect(jsonPath("$.attachments[0].url").value(org.hamcrest.Matchers.startsWith("/files/records/")));

        // second upload appends
        MockMultipartFile png = new MockMultipartFile(
                "file", "xray.png", "image/png", new byte[] {1, 2, 3});
        mockMvc.perform(multipart("/api/v1/records/" + recordId + "/attachments").file(png)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attachments.length()").value(2));

        // unsupported extension -> 400
        MockMultipartFile exe = new MockMultipartFile(
                "file", "virus.exe", "application/octet-stream", new byte[] {1});
        mockMvc.perform(multipart("/api/v1/records/" + recordId + "/attachments").file(exe)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        // empty file -> 400
        MockMultipartFile empty = new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[0]);
        mockMvc.perform(multipart("/api/v1/records/" + recordId + "/attachments").file(empty)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        // attached file is publicly served
        String body = mockMvc.perform(get("/api/v1/records/" + recordId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String url = JSON.readTree(body).get("attachments").get(0).get("url").asText();
        mockMvc.perform(get(url)).andExpect(status().isOk());
    }
}
