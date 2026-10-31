package jp.sabun.comparison;

import jp.sabun.config.QueueConfiguration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.queue", havingValue = "true", matchIfMissing = true)
class RabbitJobDispatcher {
    private final JobRepository jobs;
    private final RabbitTemplate rabbit;
    private final JobProcessor processor;

    RabbitJobDispatcher(JobRepository jobs, RabbitTemplate rabbit, JobProcessor processor) {
        this.jobs = jobs;
        this.rabbit = rabbit;
        this.processor = processor;
    }

    @Scheduled(fixedDelay = 5000, initialDelay = 3000)
    void dispatch() {
        for (var job : jobs.pending(Instant.now().minusSeconds(60), PageRequest.of(0, 50))) {
            // Durable DB outbox: re-publication is safe because consumers atomically claim
            // jobs.
            job.dispatchedAt = Instant.now();
            jobs.save(job);
            try {
                rabbit.convertAndSend(QueueConfiguration.QUEUE, job.id.toString());
            } catch (Exception e) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("job.dispatch_failed jobId={} reason={}; will retry", job.id, e.toString());
            }
        }
    }

    @RabbitListener(queues = QueueConfiguration.QUEUE)
    void receive(String id) {
        processor.process(UUID.fromString(id));
    }
}
