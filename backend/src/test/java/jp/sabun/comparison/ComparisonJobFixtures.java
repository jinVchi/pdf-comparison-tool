package jp.sabun.comparison;

import java.time.Instant;
import java.util.UUID;

/** Cross-feature test setup without exposing mutable entity fields outside the comparison package. */
public final class ComparisonJobFixtures {
    public static final class Fixture {
        public final UUID id;
        public final String ownerId;
        private final ComparisonJob job;

        private Fixture(ComparisonJob job) {
            this.id = job.id;
            this.ownerId = job.ownerId;
            this.job = job;
        }
    }

    public static Fixture completed(JobRepository jobs, String owner) {
        var job = new ComparisonJob();
        job.id = UUID.randomUUID();
        job.ownerId = owner;
        job.status = ComparisonJob.Status.COMPLETED;
        job.originalName = "original.pdf";
        job.revisedName = "revised.pdf";
        job.mode = "text";
        job.createdAt = Instant.now();
        job.updatedAt = job.createdAt;
        job.resultJson = "{\"pages\":[],\"changes\":[],\"warnings\":[]}";
        return new Fixture(jobs.saveAndFlush(job));
    }

    public static String ownerId(JobRepository jobs, UUID id) {
        return jobs.findById(id).orElseThrow().ownerId;
    }

    public static void saveStaleWorkerProgress(JobRepository jobs, Fixture stale) {
        stale.job.status = ComparisonJob.Status.PROCESSING;
        stale.job.progress = 50;
        jobs.saveAndFlush(stale.job);
    }

    public static int progress(JobRepository jobs, UUID id) {
        return jobs.findById(id).orElseThrow().progress;
    }
}
