package com.petcare.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class PetFlowTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    private String uniqueEmail() {
        return "petuser" + System.nanoTime() + "@example.com";
    }

    /** Registers a user and returns its JWT access token. */
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

    private long createPet(String token, String name, String species, LocalDate birthDate) throws Exception {
        var payload = new java.util.HashMap<String, Object>();
        payload.put("name", name);
        payload.put("species", species);
        if (birthDate != null) {
            payload.put("birthDate", birthDate.toString());
        }
        String body = mockMvc.perform(post("/api/v1/pets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(body).get("id").asLong();
    }

    @Test
    void createListGetPatchDeleteFlow() throws Exception {
        String token = registerAndLogin(uniqueEmail());

        long id = createPet(token, "Rex", "DOG", LocalDate.of(2020, 1, 15));

        mockMvc.perform(get("/api/v1/pets").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Rex"))
                .andExpect(jsonPath("$[0].species").value("DOG"));

        mockMvc.perform(get("/api/v1/pets/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Rex"));

        // PATCH: rename only — species/birthDate must stay untouched.
        mockMvc.perform(patch("/api/v1/pets/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("name", "Max"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Max"))
                .andExpect(jsonPath("$.species").value("DOG"))
                .andExpect(jsonPath("$.birthDate").value("2020-01-15"));

        // Soft delete -> 204, then not visible anywhere.
        mockMvc.perform(delete("/api/v1/pets/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/pets").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0]").doesNotExist());

        mockMvc.perform(get("/api/v1/pets/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void validationRejectsBlankNameAndFutureBirthDate() throws Exception {
        String token = registerAndLogin(uniqueEmail());

        mockMvc.perform(post("/api/v1/pets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("name", "", "species", "CAT"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.details[0].field").value("name"));

        mockMvc.perform(post("/api/v1/pets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of(
                                "name", "Future", "species", "CAT",
                                "birthDate", LocalDate.now().plusDays(1).toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details[0].field").value("birthDate"));
    }

    @Test
    void otherUsersCannotTouchForeignPet() throws Exception {
        String ownerToken = registerAndLogin(uniqueEmail());
        String strangerToken = registerAndLogin(uniqueEmail());

        long id = createPet(ownerToken, "Ghost", "HAMSTER", null);

        mockMvc.perform(get("/api/v1/pets/" + id).header("Authorization", "Bearer " + strangerToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(patch("/api/v1/pets/" + id)
                        .header("Authorization", "Bearer " + strangerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.writeValueAsString(Map.of("name", "Stolen"))))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/pets/" + id).header("Authorization", "Bearer " + strangerToken))
                .andExpect(status().isNotFound());

        // Owner still sees the pet intact.
        mockMvc.perform(get("/api/v1/pets/" + id).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ghost"));
    }

    @Test
    void unauthenticatedRequestsAreRejected() throws Exception {
        mockMvc.perform(get("/api/v1/pets")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/pets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X\",\"species\":\"DOG\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void photoUploadStoresFileAndReturnsUrl() throws Exception {
        String token = registerAndLogin(uniqueEmail());
        long id = createPet(token, "Pixel", "CAT", null);

        MockMultipartFile photo = new MockMultipartFile(
                "file", "cat.png", "image/png", new byte[]{1, 2, 3, 4, 5});

        String body = mockMvc.perform(multipart("/api/v1/pets/" + id + "/photo")
                        .file(photo)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photoUrl").isString())
                .andReturn().getResponse().getContentAsString();

        String photoUrl = JSON.readTree(body).get("photoUrl").asText();
        org.junit.jupiter.api.Assertions.assertTrue(photoUrl.startsWith("/files/uploads/pets/"),
                "photoUrl should be a relative served path, was: " + photoUrl);

        String otherToken = registerAndLogin(uniqueEmail());
        for (String path : new String[]{photoUrl, photoUrl.replace("/uploads", "")}) {
            mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
            mockMvc.perform(get(path).header("Authorization", "Bearer " + otherToken))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get(path).header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(content().contentType(MediaType.IMAGE_PNG))
                    .andExpect(content().bytes(photo.getBytes()));
        }

        // Reject unsupported extension.
        MockMultipartFile bad = new MockMultipartFile(
                "file", "evil.exe", "application/octet-stream", new byte[]{1});
        mockMvc.perform(multipart("/api/v1/pets/" + id + "/photo")
                        .file(bad)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Unsupported file type")));
    }
}
