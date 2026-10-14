package jp.sabun;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.*;

@Configuration
class QueueConfiguration {
    static final String QUEUE="sabun.compare";
    @Bean @ConditionalOnProperty(name="app.queue",havingValue="true",matchIfMissing=true)
    Declarables queues() {
        return new Declarables(new Queue("sabun.dead",true),new DirectExchange("sabun.dead-exchange"),
            new Binding("sabun.dead",Binding.DestinationType.QUEUE,"sabun.dead-exchange","",null),
            QueueBuilder.durable(QUEUE).deadLetterExchange("sabun.dead-exchange").build());
    }
}

@Component
@ConditionalOnProperty(name="app.queue",havingValue="true",matchIfMissing=true)
class RabbitJobDispatcher {
    private final JobRepository jobs; private final RabbitTemplate rabbit; private final JobProcessor processor;
    RabbitJobDispatcher(JobRepository jobs,RabbitTemplate rabbit,JobProcessor processor){this.jobs=jobs;this.rabbit=rabbit;this.processor=processor;}
    @Scheduled(fixedDelay=5000,initialDelay=3000)
    void dispatch() {
        for(var job:jobs.pending(Instant.now().minusSeconds(60),PageRequest.of(0,50))) {
            // Durable DB outbox: re-publication is safe because consumers atomically claim jobs.
            job.dispatchedAt=Instant.now();jobs.save(job);
            try { rabbit.convertAndSend(QueueConfiguration.QUEUE,job.id.toString()); }
            catch(Exception e) { org.slf4j.LoggerFactory.getLogger(getClass()).warn("Queue unavailable; job {} will retry",job.id); }
        }
    }
    @RabbitListener(queues=QueueConfiguration.QUEUE)
    void receive(String id) { processor.process(UUID.fromString(id)); }
}

@Component
@ConditionalOnProperty(name="app.queue",havingValue="false")
class LocalJobDispatcher implements AutoCloseable {
    private final JobRepository jobs; private final JobProcessor processor;
    private final ExecutorService workers=Executors.newFixedThreadPool(2);
    LocalJobDispatcher(JobRepository jobs,JobProcessor processor){this.jobs=jobs;this.processor=processor;}
    @Scheduled(fixedDelay=2000)
    void dispatch() {
        for(var job:jobs.pending(Instant.now().minusSeconds(60),PageRequest.of(0,2))) {
            job.dispatchedAt=Instant.now();jobs.save(job);workers.submit(()->processor.process(job.id));
        }
    }
    @Override public void close(){workers.shutdownNow();}
}
