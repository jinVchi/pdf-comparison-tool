package jp.sabun.comparison;

import jp.sabun.auth.WorkspaceIdentity;
import jp.sabun.storage.FileStorage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import java.nio.file.Files;
import java.time.Instant;
import java.util.UUID;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties = { "spring.datasource.url=jdbc:h2:mem:api;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "app.queue=false",
        "app.storage=target/test-files", "spring.rabbitmq.listener.simple.auto-startup=false" })
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class ComparisonApiTest {
    @Autowired
    MockMvc mvc;
    @Autowired
    JobRepository jobs;
    @Autowired
    FileStorage files;

    private MockHttpSession account(UUID id) {
        var session = new MockHttpSession();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                new WorkspaceIdentity.Account(id, id + "@example.com"), null,
                AuthorityUtils.createAuthorityList("ROLE_USER")));
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        return session;
    }

    @Test
    void writesRequireCsrf() throws Exception {
        mvc.perform(post("/api/comparisons/demo").session(account(UUID.randomUUID())))
                .andExpect(status().isForbidden());
    }

    @Test
    void invalidUploadsDoNotCreateJobs() throws Exception {
        mvc.perform(multipart("/api/comparisons")
                .file(new MockMultipartFile("original", "fake.pdf", "application/pdf", "not a pdf".getBytes()))
                .file(new MockMultipartFile("revised", "fake.pdf", "application/pdf", "not a pdf".getBytes()))
                .session(account(UUID.randomUUID()))
                .with(csrf())).andExpect(status().isBadRequest());
    }

    @Test
    void accountsCannotReadDownloadOrDeleteOtherJobs() throws Exception {
        var ownerId = UUID.randomUUID();
        var owner = account(ownerId);
        mvc.perform(get("/api/session").session(owner)).andExpect(status().isOk());
        var job = new ComparisonJob();
        job.id = UUID.randomUUID();
        job.ownerId = "user:" + ownerId;
        job.status = ComparisonJob.Status.COMPLETED;
        job.originalName = "original.pdf";
        job.revisedName = "revised.pdf";
        job.mode = "text";
        job.createdAt = Instant.now();
        job.updatedAt = Instant.now();
        job.resultJson = "{\"pages\":[],\"changes\":[],\"warnings\":[]}";
        jobs.save(job);
        mvc.perform(get("/api/comparisons/" + job.id).session(owner)).andExpect(status().isOk())
                .andExpect(jsonPath("$.originalName").value("original.pdf"));
        var other = account(UUID.randomUUID());
        for (String suffix : new String[] { "", "/report", "/pages/original/1" })
            mvc.perform(get("/api/comparisons/" + job.id + suffix).session(other)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/comparisons/" + job.id).session(other).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(get("/api/comparisons").session(other)).andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(delete("/api/comparisons/" + job.id).session(owner).with(csrf())).andExpect(status().isNoContent());
    }

    private ComparisonJob saved(UUID accountId, ComparisonJob.Status status) {
        var job = new ComparisonJob();
        job.id = UUID.randomUUID();
        job.ownerId = "user:" + accountId;
        job.status = status;
        job.originalName = "a.pdf";
        job.revisedName = "b.pdf";
        job.mode = "text";
        job.progress = 40;
        job.createdAt = Instant.now();
        job.updatedAt = job.createdAt;
        job.dispatchedAt = job.createdAt;
        job.errorMessage = status == ComparisonJob.Status.FAILED ? "failed" : null;
        return jobs.saveAndFlush(job);
    }

    private void storeUploads(UUID id) throws Exception {
        files.directory(id);
        Files.writeString(files.file(id, "original.pdf"), "%PDF-1.7");
        Files.writeString(files.file(id, "revised.pdf"), "%PDF-1.7");
    }

    @Test
    void retryQueuesAFailedJobAgain() throws Exception {
        var accountId = UUID.randomUUID();
        var job = saved(accountId, ComparisonJob.Status.FAILED);
        storeUploads(job.id);
        mvc.perform(post("/api/comparisons/" + job.id + "/retry").session(account(accountId)).with(csrf()))
                .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("QUEUED"))
                .andExpect(jsonPath("$.progress").value(0)).andExpect(jsonPath("$.error").isEmpty());
        // The local dispatcher may already be processing it, so only the response is stable here.
        jobs.deleteById(job.id);
        files.delete(job.id);
    }

    @Test
    void onlyFailedJobsWithTheirUploadsCanBeRetried() throws Exception {
        var accountId = UUID.randomUUID();
        var completed = saved(accountId, ComparisonJob.Status.COMPLETED);
        storeUploads(completed.id);
        mvc.perform(post("/api/comparisons/" + completed.id + "/retry").session(account(accountId)).with(csrf()))
                .andExpect(status().isConflict());
        var expired = saved(accountId, ComparisonJob.Status.FAILED);
        mvc.perform(post("/api/comparisons/" + expired.id + "/retry").session(account(accountId)).with(csrf()))
                .andExpect(status().isGone());
        mvc.perform(post("/api/comparisons/" + expired.id + "/retry").session(account(UUID.randomUUID()))
                .with(csrf())).andExpect(status().isNotFound());
        jobs.deleteAllById(java.util.List.of(completed.id, expired.id));
        files.delete(completed.id);
    }

    @Test
    void retryRespectsTheActiveJobLimit() throws Exception {
        var accountId = UUID.randomUUID();
        var active = java.util.stream.Stream.generate(() -> saved(accountId, ComparisonJob.Status.QUEUED)).limit(3)
                .toList();
        var failed = saved(accountId, ComparisonJob.Status.FAILED);
        storeUploads(failed.id);
        mvc.perform(post("/api/comparisons/" + failed.id + "/retry").session(account(accountId)).with(csrf()))
                .andExpect(status().isTooManyRequests());
        assertThat(jobs.findById(failed.id).orElseThrow().status).isEqualTo(ComparisonJob.Status.FAILED);
        active.forEach(j -> jobs.deleteById(j.id));
        jobs.deleteById(failed.id);
        files.delete(failed.id);
    }

    @Test
    void cancelRemovesAPendingJobAndItsUploads() throws Exception {
        var accountId = UUID.randomUUID();
        var job = saved(accountId, ComparisonJob.Status.QUEUED);
        storeUploads(job.id);
        mvc.perform(post("/api/comparisons/" + job.id + "/cancel").session(account(UUID.randomUUID())).with(csrf()))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/comparisons/" + job.id + "/cancel").session(account(accountId)).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(jobs.findById(job.id)).isEmpty();
        assertThat(Files.exists(files.file(job.id, "original.pdf"))).isFalse();
        assertThat(jobs.claim(job.id, Instant.now())).isZero();
    }

    @Test
    void jobsThatAlreadyStartedCannotBeCanceled() throws Exception {
        var accountId = UUID.randomUUID();
        for (var status : new ComparisonJob.Status[] { ComparisonJob.Status.PROCESSING,
                ComparisonJob.Status.COMPLETED, ComparisonJob.Status.FAILED }) {
            var job = saved(accountId, status);
            mvc.perform(post("/api/comparisons/" + job.id + "/cancel").session(account(accountId)).with(csrf()))
                    .andExpect(status().isConflict());
            assertThat(jobs.findById(job.id)).isPresent();
            jobs.deleteById(job.id);
        }
    }

    @Test
    void duplicateQueueDeliveryCanOnlyClaimOnce() {
        var job = new ComparisonJob();
        job.id = UUID.randomUUID();
        job.ownerId = "test";
        job.status = ComparisonJob.Status.QUEUED;
        job.originalName = "a.pdf";
        job.revisedName = "b.pdf";
        job.mode = "text";
        job.createdAt = Instant.now();
        job.updatedAt = Instant.now();
        jobs.save(job);
        assertThat(jobs.claim(job.id, Instant.now())).isEqualTo(1);
        assertThat(jobs.claim(job.id, Instant.now())).isZero();
        jobs.deleteById(job.id);
    }

    private String logLine(CapturedOutput output, String event) {
        return output.getOut().lines().filter(line -> line.contains(event)).findFirst().orElse("");
    }

    private ComparisonJob.Status awaitFinished(UUID id) throws InterruptedException {
        for (int i = 0; i < 120; i++) {
            var status = jobs.findById(id).orElseThrow().status;
            if (status == ComparisonJob.Status.COMPLETED || status == ComparisonJob.Status.FAILED)
                return status;
            Thread.sleep(250);
        }
        throw new AssertionError("Job " + id + " did not finish");
    }

    @Test
    void jobLifecycleIsLoggedWithTheJobIdAndDuration(CapturedOutput output) throws Exception {
        var accountId = UUID.randomUUID();
        String body = mvc.perform(post("/api/comparisons/demo").session(account(accountId)).with(csrf()))
                .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        var id = UUID.fromString(com.jayway.jsonpath.JsonPath.read(body, "$.id"));
        assertThat(awaitFinished(id)).isEqualTo(ComparisonJob.Status.COMPLETED);
        assertThat(logLine(output, "job.created")).contains(id.toString()).contains("mode=mixed");
        assertThat(logLine(output, "job.started")).contains(id.toString());
        assertThat(logLine(output, "job.completed")).contains(id.toString()).contains("pages=2")
                .containsPattern("changes=\\d+").containsPattern("durationMs=\\d+");
        jobs.deleteById(id);
        files.delete(id);
    }

    @Test
    void unreadablePdfsAreRejectedAndLoggedWithTheCause(CapturedOutput output) throws Exception {
        byte[] corrupt = "%PDF-1.7 truncated".getBytes();
        mvc.perform(multipart("/api/comparisons")
                .file(new MockMultipartFile("original", "a.pdf", "application/pdf", corrupt))
                .file(new MockMultipartFile("revised", "b.pdf", "application/pdf", corrupt))
                .session(account(UUID.randomUUID())).with(csrf())).andExpect(status().isBadRequest());
        assertThat(logLine(output, "api.pdf_rejected")).contains("WARN").contains("reason=");
    }

    @Test
    void failedJobsAreLoggedAsErrorsWithTheCause(CapturedOutput output) throws Exception {
        var job = saved(UUID.randomUUID(), ComparisonJob.Status.QUEUED);
        storeUploads(job.id);
        job.dispatchedAt = null;
        jobs.saveAndFlush(job);
        assertThat(awaitFinished(job.id)).isEqualTo(ComparisonJob.Status.FAILED);
        assertThat(logLine(output, "job.failed")).contains("ERROR").contains(job.id.toString())
                .containsPattern("durationMs=\\d+");
        jobs.deleteById(job.id);
        files.delete(job.id);
    }
}
