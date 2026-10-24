package jp.sabun;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Bounded, single-instance protection. Production deployments also need perimeter limits. */
@Component
class AuthRateLimiter {
    private record Window(Instant expiresAt, int attempts) {}
    private final Map<String, Window> windows = new HashMap<>();
    private final Clock clock;

    AuthRateLimiter() {
        this(Clock.systemUTC());
    }

    AuthRateLimiter(Clock clock) {
        this.clock = clock;
    }

    synchronized void check(String address, boolean registration) {
        Instant now = clock.instant();
        windows.entrySet().removeIf(e -> !e.getValue().expiresAt().isAfter(now));
        String key = (registration ? "register:" : "login:") + address;
        var current = windows.get(key);
        int limit = registration ? 5 : 20;
        if ((current != null && current.attempts() >= limit) || (current == null && windows.size() >= 10_000))
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "試行回数が多すぎます。15分後にもう一度お試しください。");
        windows.put(key, new Window(current == null ? now.plus(Duration.ofMinutes(15)) : current.expiresAt(),
                current == null ? 1 : current.attempts() + 1));
    }
}
