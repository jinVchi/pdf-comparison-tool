package jp.sabun.auth;

import java.time.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthRateLimiterTest {
    @Test
    void limitsByAddressAndActionAndAllowsRetriesAfterTheWindowExpires() {
        var clock = mock(Clock.class);
        var start = Instant.parse("2026-01-01T00:00:00Z");
        when(clock.instant()).thenReturn(start);
        var limiter = new AuthRateLimiter(clock);
        for (int i = 0; i < 5; i++) limiter.check("client-a", true);
        assertThatThrownBy(() -> limiter.check("client-a", true))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(429));
        limiter.check("client-b", true);
        for (int i = 0; i < 20; i++) limiter.check("client-a", false);
        assertThatThrownBy(() -> limiter.check("client-a", false)).isInstanceOf(ResponseStatusException.class);
        when(clock.instant()).thenReturn(start.plus(Duration.ofMinutes(15)));
        limiter.check("client-a", true);
        limiter.check("client-a", false);
    }
}
