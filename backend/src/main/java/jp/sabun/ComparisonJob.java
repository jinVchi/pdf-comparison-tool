package jp.sabun;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
class ComparisonJob {
    @Id
    UUID id;
    @Column(nullable = false)
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
