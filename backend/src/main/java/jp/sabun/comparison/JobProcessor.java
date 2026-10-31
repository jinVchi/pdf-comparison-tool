package jp.sabun.comparison;

import jp.sabun.storage.FileStorage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.UUID;

@Component
class JobProcessor {
    private static final Logger log = LoggerFactory.getLogger(JobProcessor.class);
    private final JobRepository jobs;
    private final FileStorage storage;
    private final PdfComparisonEngine engine;
    private final ObjectMapper json;

    JobProcessor(JobRepository jobs, FileStorage storage, PdfComparisonEngine engine, ObjectMapper json) {
        this.jobs = jobs;
        this.storage = storage;
        this.engine = engine;
        this.json = json;
    }

    void process(UUID id) {
        // Every log line from this job, including engine and OCR warnings, carries its id.
        try (var ignored = MDC.putCloseable("jobId", id.toString())) {
            if (jobs.claim(id, Instant.now()) == 0)
                return;
            ComparisonJob job = jobs.findById(id).orElseThrow();
            long started = System.nanoTime();
            log.info("job.started mode={}", job.mode);
            try {
                var result = engine.compare(storage.file(id, "original.pdf"), storage.file(id, "revised.pdf"),
                        storage.directory(id), job.mode, job.ignoreWhitespace, job.normalizeWidth, p -> {
                            job.progress = p;
                            job.updatedAt = Instant.now();
                            jobs.save(job);
                        });
                job.resultJson = json.writeValueAsString(result);
                job.pageCount = result.pages().size();
                job.changeCount = result.changes().size();
                job.status = ComparisonJob.Status.COMPLETED;
                log.info("job.completed pages={} changes={} durationMs={}", job.pageCount, job.changeCount,
                        elapsedMillis(started));
            } catch (Exception e) {
                log.error("job.failed durationMs={}", elapsedMillis(started), e);
                job.status = ComparisonJob.Status.FAILED;
                job.errorMessage = "比較できませんでした。PDFが破損していないか確認し、ページ数を減らして再度お試しください。";
            }
            job.updatedAt = Instant.now();
            jobs.save(job);
        }
    }

    private static long elapsedMillis(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
