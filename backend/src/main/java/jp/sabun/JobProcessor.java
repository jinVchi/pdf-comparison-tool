package jp.sabun;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.UUID;

@Component
class JobProcessor {
    private final JobRepository jobs; private final FileStorage storage; private final PdfComparisonEngine engine; private final ObjectMapper json;
    JobProcessor(JobRepository jobs, FileStorage storage, PdfComparisonEngine engine, ObjectMapper json) {
        this.jobs=jobs;this.storage=storage;this.engine=engine;this.json=json;
    }
    void process(UUID id) {
        if(jobs.claim(id,Instant.now())==0) return;
        ComparisonJob job=jobs.findById(id).orElseThrow();
        try {
            var result=engine.compare(storage.file(id,"original.pdf"),storage.file(id,"revised.pdf"),storage.directory(id),job.mode,job.ignoreWhitespace,job.normalizeWidth,p->{
                job.progress=p;job.updatedAt=Instant.now();jobs.save(job);
            });
            job.resultJson=json.writeValueAsString(result);job.pageCount=result.pages().size();job.changeCount=result.changes().size();job.status=ComparisonJob.Status.COMPLETED;
        } catch(Exception e) {
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("Comparison {} failed",id,e);
            job.status=ComparisonJob.Status.FAILED;
            job.errorMessage="比較できませんでした。PDFが破損していないか確認し、ページ数を減らして再度お試しください。";
        }
        job.updatedAt=Instant.now();jobs.save(job);
    }
}
