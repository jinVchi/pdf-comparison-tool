package jp.sabun.comparison;

import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.queue", havingValue = "false")
class LocalJobDispatcher implements AutoCloseable {
    private final JobRepository jobs;
    private final JobProcessor processor;
    private final ExecutorService workers = Executors.newFixedThreadPool(2);

    LocalJobDispatcher(JobRepository jobs, JobProcessor processor) {
        this.jobs = jobs;
        this.processor = processor;
    }

    @Scheduled(fixedDelay = 2000)
    void dispatch() {
        for (var job : jobs.pending(Instant.now().minusSeconds(60), PageRequest.of(0, 2))) {
            job.dispatchedAt = Instant.now();
            jobs.save(job);
            workers.submit(() -> processor.process(job.id));
        }
    }

    @Override
    public void close() {
        workers.shutdownNow();
    }
}
