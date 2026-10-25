package jp.sabun.config;

import org.springframework.amqp.core.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class QueueConfiguration {
    public static final String QUEUE = "sabun.compare";

    @Bean
    @ConditionalOnProperty(name = "app.queue", havingValue = "true", matchIfMissing = true)
    Declarables queues() {
        return new Declarables(new Queue("sabun.dead", true), new DirectExchange("sabun.dead-exchange"),
                new Binding("sabun.dead", Binding.DestinationType.QUEUE, "sabun.dead-exchange", "", null),
                QueueBuilder.durable(QUEUE).deadLetterExchange("sabun.dead-exchange").build());
    }
}
