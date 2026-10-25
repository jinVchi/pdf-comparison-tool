package jp.sabun;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = { "spring.datasource.url=jdbc:h2:mem:auth;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "app.queue=false",
        "app.storage=target/auth-test-files", "spring.rabbitmq.listener.simple.auto-startup=false" })
@AutoConfigureMockMvc
class AuthApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired JobRepository jobs;
    @Autowired PasswordEncoder passwords;

    private static final String PASSWORD = "a-secure-password-123";

    private String email() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    private JsonNode session(MockHttpSession session) throws Exception {
        return json.readTree(mvc.perform(get("/api/session").session(session))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private ResultActions auth(String endpoint, MockHttpSession session, String token, String email, String password)
            throws Exception {
        return mvc.perform(post("/api/auth/" + endpoint).session(session)
                .with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .header("X-CSRF-TOKEN", token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", password))));
    }

    private void register(MockHttpSession session, String email) throws Exception {
        auth("sign-up", session, session(session).get("csrfToken").asText(), email, PASSWORD)
                .andExpect(status().isCreated());
    }

    private ComparisonJob job(MockHttpSession guest) {
        // Simulate a workspace created by an older app version; the current API never creates these.
        if (guest.getAttribute("workspace") == null)
            guest.setAttribute("workspace", UUID.randomUUID().toString());
        var job = new ComparisonJob();
        job.id = UUID.randomUUID();
        job.ownerId = (String) guest.getAttribute("workspace");
        job.status = ComparisonJob.Status.COMPLETED;
        job.originalName = "original.pdf";
        job.revisedName = "revised.pdf";
        job.mode = "text";
        job.createdAt = Instant.now();
        job.updatedAt = job.createdAt;
        job.resultJson = "{\"pages\":[],\"changes\":[],\"warnings\":[]}";
        return jobs.saveAndFlush(job);
    }

    @Test
    void registrationHashesPasswordsRotatesSessionAndPreservesLegacyGuestHistory() throws Exception {
        var guest = new MockHttpSession();
        var initial = session(guest);
        assertThat(initial.get("user").isNull()).isTrue();
        assertThat(guest.getAttribute("workspace")).isNull();
        String oldId = guest.getId();
        var own = job(guest);
        var other = new MockHttpSession();
        session(other);
        var foreign = job(other);
        String email = email();
        auth("sign-up", guest, initial.get("csrfToken").asText(), "  " + email.toUpperCase() + "  ", PASSWORD)
                .andExpect(status().isCreated()).andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        assertThat(guest.getId()).isNotEqualTo(oldId);
        assertThat(guest.getAttribute("workspace")).isNull();
        var user = users.findByEmail(email).orElseThrow();
        assertThat(user.passwordHash).isNotEqualTo(PASSWORD).startsWith("$2");
        assertThat(passwords.matches(PASSWORD, user.passwordHash)).isTrue();
        var authenticated = session(guest);
        assertThat(authenticated.get("user").get("id").asText()).isEqualTo(user.id.toString());
        assertThat(jobs.findById(own.id).orElseThrow().ownerId).isEqualTo("user:" + user.id);
        assertThat(jobs.findById(foreign.id).orElseThrow().ownerId).isEqualTo(foreign.ownerId);
        mvc.perform(get("/api/comparisons/" + own.id).session(guest)).andExpect(status().isOk());
        mvc.perform(get("/api/comparisons/" + own.id).session(other)).andExpect(status().isUnauthorized());
        // A pre-authentication token cannot authorize account mutations after sign-up.
        mvc.perform(post("/api/auth/sign-out").session(guest)
                .header("X-CSRF-TOKEN", initial.get("csrfToken").asText())).andExpect(status().isForbidden());
    }

    @Test
    void signOutInvalidatesSessionAndSigningInFromAnotherBrowserRestoresHistory() throws Exception {
        String email = email();
        var first = new MockHttpSession();
        session(first);
        var own = job(first);
        register(first, email);
        String csrf = session(first).get("csrfToken").asText();
        mvc.perform(post("/api/auth/sign-out").session(first).header("X-CSRF-TOKEN", csrf))
                .andExpect(status().isNoContent());
        assertThat(first.isInvalid()).isTrue();
        var fresh = new MockHttpSession();
        var token = session(fresh);
        mvc.perform(get("/api/comparisons/" + own.id).session(fresh)).andExpect(status().isUnauthorized());
        var guestJob = job(fresh);
        String oldId = fresh.getId();
        auth("sign-in", fresh, token.get("csrfToken").asText(), email.toUpperCase(), PASSWORD)
                .andExpect(status().isOk());
        assertThat(fresh.getId()).isNotEqualTo(oldId);
        session(fresh);
        mvc.perform(get("/api/comparisons/" + own.id).session(fresh)).andExpect(status().isOk());
        mvc.perform(get("/api/comparisons/" + guestJob.id).session(fresh)).andExpect(status().isOk());
        assertThat(jobs.findById(own.id).orElseThrow().ownerId)
                .isEqualTo(jobs.findById(guestJob.id).orElseThrow().ownerId);
        mvc.perform(post("/api/auth/sign-out").session(fresh)
                .header("X-CSRF-TOKEN", token.get("csrfToken").asText())).andExpect(status().isForbidden());
    }

    @Test
    void accountsCannotReadDownloadOrDeleteEachOthersDocuments() throws Exception {
        var first = new MockHttpSession();
        session(first);
        var own = job(first);
        register(first, email());
        var second = new MockHttpSession();
        register(second, email());
        for (String suffix : new String[] { "", "/report", "/pages/original/1" })
            mvc.perform(get("/api/comparisons/" + own.id + suffix).session(second)).andExpect(status().isNotFound());
        mvc.perform(get("/api/comparisons").session(second)).andExpect(content().json("[]"));
        mvc.perform(delete("/api/comparisons/" + own.id).session(second)
                .header("X-CSRF-TOKEN", session(second).get("csrfToken").asText())).andExpect(status().isNotFound());
        mvc.perform(get("/api/comparisons/" + own.id).session(first)).andExpect(status().isOk());
        // A signed-in user cannot switch accounts and accidentally transfer existing account data.
        auth("sign-in", first, session(first).get("csrfToken").asText(), email(), PASSWORD)
                .andExpect(status().isConflict());
    }

    @Test
    void duplicateNormalizedEmailsAreRejectedWithoutChangingGuestOwnership() throws Exception {
        String email = email();
        register(new MockHttpSession(), email);
        var other = new MockHttpSession();
        var token = session(other);
        var own = job(other);
        auth("sign-up", other, token.get("csrfToken").asText(), email.toUpperCase(), PASSWORD)
                .andExpect(status().isConflict());
        assertThat(session(other).get("user").isNull()).isTrue();
        assertThat(jobs.findById(own.id).orElseThrow().ownerId).isEqualTo(own.ownerId);
    }

    @Test
    void wrongAndUnknownCredentialsUseTheSameErrorAndDoNotAuthenticateOrTransferJobs() throws Exception {
        String email = email();
        register(new MockHttpSession(), email);
        var guest = new MockHttpSession();
        var token = session(guest);
        var own = job(guest);
        String wrong = auth("sign-in", guest, token.get("csrfToken").asText(), email, "wrong-password-123")
                .andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
        String unknown = auth("sign-in", guest, token.get("csrfToken").asText(), email(), PASSWORD)
                .andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
        assertThat(wrong).isEqualTo(unknown);
        assertThat(session(guest).get("user").isNull()).isTrue();
        assertThat(jobs.findById(own.id).orElseThrow().ownerId).isEqualTo(own.ownerId);
    }

    @Test
    void validatesEmailsPasswordLengthAndUtf8BytesWithoutTruncation() throws Exception {
        var guest = new MockHttpSession();
        String token = session(guest).get("csrfToken").asText();
        auth("sign-up", guest, token, "invalid", PASSWORD).andExpect(status().isBadRequest());
        auth("sign-up", guest, token, email(), "too-short").andExpect(status().isBadRequest());
        auth("sign-up", guest, token, email(), "a".repeat(73)).andExpect(status().isBadRequest());
        auth("sign-up", guest, token, email(), "あ".repeat(25)).andExpect(status().isBadRequest());
        String email = email();
        auth("sign-up", guest, token, email, "あ".repeat(24)).andExpect(status().isCreated());
        var another = new MockHttpSession();
        String anotherToken = session(another).get("csrfToken").asText();
        auth("sign-in", another, anotherToken, email, "あ".repeat(24) + "extra")
                .andExpect(status().isUnauthorized());
        auth("sign-in", another, anotherToken, email, "あ".repeat(24)).andExpect(status().isOk());
    }

    @Test
    void everyAuthenticationMutationRequiresCsrfAndMalformedBodiesAreJsonErrors() throws Exception {
        for (String endpoint : new String[] { "sign-up", "sign-in", "sign-out" })
            mvc.perform(post("/api/auth/" + endpoint).contentType(MediaType.APPLICATION_JSON)
                    .content("{}")).andExpect(status().isForbidden());
        var guest = new MockHttpSession();
        String token = session(guest).get("csrfToken").asText();
        mvc.perform(post("/api/auth/sign-up").session(guest).header("X-CSRF-TOKEN", token)
                .contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isString());
        mvc.perform(post("/api/auth/sign-up").session(guest).header("X-CSRF-TOKEN", token)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anonymousUsersCannotUseAnyComparisonEndpointEvenWithValidCsrf() throws Exception {
        var anonymous = new MockHttpSession();
        var initial = session(anonymous);
        String csrf = initial.get("csrfToken").asText();
        assertThat(initial.get("user").isNull()).isTrue();
        assertThat(anonymous.getAttribute("workspace")).isNull();
        mvc.perform(get("/api/health")).andExpect(status().isOk());
        String id = UUID.randomUUID().toString();
        for (String path : new String[] { "/api/comparisons", "/api/comparisons/" + id,
                "/api/comparisons/" + id + "/report", "/api/comparisons/" + id + "/pages/original/1" })
            mvc.perform(get(path).session(anonymous)).andExpect(status().isUnauthorized())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.message").value("ログインしてからご利用ください。"))
                    .andExpect(header().doesNotExist("Location"));
        long before = jobs.count();
        mvc.perform(post("/api/comparisons/demo").session(anonymous).header("X-CSRF-TOKEN", csrf))
                .andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/comparisons").file(new MockMultipartFile("original", "fake.pdf",
                "application/pdf", "%PDF-".getBytes())).session(anonymous).header("X-CSRF-TOKEN", csrf))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/comparisons/" + id).session(anonymous).header("X-CSRF-TOKEN", csrf))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/sign-out").session(anonymous).header("X-CSRF-TOKEN", csrf))
                .andExpect(status().isUnauthorized());
        assertThat(jobs.count()).isEqualTo(before);
        assertThat(anonymous.getAttribute("workspace")).isNull();
    }

    @Test
    void staleWorkerSavesCannotUndoGuestOwnershipTransfer() throws Exception {
        var guest = new MockHttpSession();
        session(guest);
        var stale = job(guest);
        String email = email();
        register(guest, email);
        stale.status = ComparisonJob.Status.PROCESSING;
        stale.progress = 50;
        jobs.saveAndFlush(stale);
        var current = jobs.findById(stale.id).orElseThrow();
        assertThat(current.ownerId).isEqualTo("user:" + users.findByEmail(email).orElseThrow().id);
        assertThat(current.progress).isEqualTo(50);
        mvc.perform(get("/api/comparisons/" + stale.id).session(guest)).andExpect(status().isOk());
        jobs.deleteById(stale.id);
    }
}
