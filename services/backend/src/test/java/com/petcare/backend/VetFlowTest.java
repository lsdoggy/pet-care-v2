package com.petcare.backend;

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

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Sprint 4: Veterinary Appointments & Records — CRUD, ownership isolation,
 * merged per-pet history and record attachment upload.
 */
@SpringBootTest
@AutoConfigureMockMvc
class VetFlowTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

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
        String body = mockMvc.perform(post("/api/v1/appointments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.durationMinutes").value(45))
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
                .andExpect(jsonPath("$.clinicName").value("CityVet Clinic")); // untouched by PATCH

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
