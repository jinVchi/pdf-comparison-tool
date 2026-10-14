package jp.sabun;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Instant;
import java.util.UUID;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:api;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE","spring.datasource.username=sa","spring.datasource.password=","app.queue=false","app.storage=target/test-files","spring.rabbitmq.listener.simple.auto-startup=false"})
@AutoConfigureMockMvc
class ComparisonApiTest {
    @Autowired MockMvc mvc;@Autowired JobRepository jobs;
    @Test void writesRequireCsrf() throws Exception {mvc.perform(post("/api/comparisons/demo")).andExpect(status().isForbidden());}
    @Test void invalidUploadsDoNotCreateJobs() throws Exception {
        mvc.perform(multipart("/api/comparisons").file(new MockMultipartFile("original","fake.pdf","application/pdf","not a pdf".getBytes())).file(new MockMultipartFile("revised","fake.pdf","application/pdf","not a pdf".getBytes())).with(csrf())).andExpect(status().isBadRequest());
    }
    @Test void sessionsCannotReadDownloadOrDeleteOtherJobs() throws Exception {
        var owner=new MockHttpSession();mvc.perform(get("/api/session").session(owner)).andExpect(status().isOk());
        var job=new ComparisonJob();job.id=UUID.randomUUID();job.ownerId=(String)owner.getAttribute("workspace");job.status=ComparisonJob.Status.COMPLETED;
        job.originalName="original.pdf";job.revisedName="revised.pdf";job.mode="text";job.createdAt=Instant.now();job.updatedAt=Instant.now();job.resultJson="{\"pages\":[],\"changes\":[],\"warnings\":[]}";jobs.save(job);
        mvc.perform(get("/api/comparisons/"+job.id).session(owner)).andExpect(status().isOk()).andExpect(jsonPath("$.originalName").value("original.pdf"));
        var other=new MockHttpSession();
        for(String suffix:new String[]{"","/report","/pages/original/1"})mvc.perform(get("/api/comparisons/"+job.id+suffix).session(other)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/comparisons/"+job.id).session(other).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(get("/api/comparisons").session(other)).andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(delete("/api/comparisons/"+job.id).session(owner).with(csrf())).andExpect(status().isNoContent());
    }
    @Test void duplicateQueueDeliveryCanOnlyClaimOnce() {
        var job=new ComparisonJob();job.id=UUID.randomUUID();job.ownerId="test";job.status=ComparisonJob.Status.QUEUED;job.originalName="a.pdf";job.revisedName="b.pdf";job.mode="text";job.createdAt=Instant.now();job.updatedAt=Instant.now();jobs.save(job);
        assertThat(jobs.claim(job.id,Instant.now())).isEqualTo(1);assertThat(jobs.claim(job.id,Instant.now())).isZero();jobs.deleteById(job.id);
    }
}
