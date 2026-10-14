package jp.sabun;

import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class JobMaintenance {
    private final JobRepository jobs;private final FileStorage files;private final int retention;
    JobMaintenance(JobRepository jobs,FileStorage files,@Value("${app.retention-hours:24}") int retention){this.jobs=jobs;this.files=files;this.retention=retention;}
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    void maintain() {
        for(var job:jobs.findByUpdatedAtBeforeAndStatus(Instant.now().minusSeconds(900),ComparisonJob.Status.PROCESSING)) {
            job.status=ComparisonJob.Status.FAILED;job.errorMessage="処理が中断されました。もう一度比較してください。";job.updatedAt=Instant.now();jobs.save(job);
        }
        for(var job:jobs.findByCreatedAtBeforeAndStatusIn(Instant.now().minusSeconds(retention*3600L),List.of(ComparisonJob.Status.COMPLETED,ComparisonJob.Status.FAILED))) {
            try { files.delete(job.id);jobs.delete(job); }
            catch(Exception e){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Could not expire {}",job.id);}
        }
    }
}
