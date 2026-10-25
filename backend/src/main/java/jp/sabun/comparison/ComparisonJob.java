package jp.sabun.comparison;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
public class ComparisonJob {
    @Id
    UUID id;
    // Ownership is transferred only through transferGuest. Detached worker saves must not revert it.
    @Column(nullable = false, updatable = false)
    String ownerId;
    @Enumerated(EnumType.STRING)
    Status status;
    String originalName;
    String revisedName;
    long originalSize;
    long revisedSize;
    String mode;
    boolean ignoreWhitespace;
    boolean normalizeWidth;
    int progress;
    int pageCount;
    int changeCount;
    Instant createdAt;
    Instant updatedAt;
    Instant dispatchedAt;
    String errorMessage;
    @Column(columnDefinition = "text")
    String resultJson;

    enum Status {
        QUEUED, PROCESSING, COMPLETED, FAILED
    }
}
