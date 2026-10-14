package jp.sabun;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api")
class ComparisonController {
    private final JobRepository jobs;private final FileStorage files;private final PdfComparisonEngine engine;private final ObjectMapper json;private final DemoDocuments demo;private final int maxActive;
    ComparisonController(JobRepository jobs,FileStorage files,PdfComparisonEngine engine,ObjectMapper json,DemoDocuments demo,@Value("${app.max-active-jobs:3}") int maxActive) {
        this.jobs=jobs;this.files=files;this.engine=engine;this.json=json;this.demo=demo;this.maxActive=maxActive;
    }
    @GetMapping("/health") Map<String,String> health() { return Map.of("status","UP"); }
    @GetMapping("/session") Map<String,Object> session(HttpSession session,CsrfToken token) {
        owner(session);return Map.of("csrfToken",token.getToken(),"csrfHeader",token.getHeaderName(),"retentionHours",24);
    }
    private String owner(HttpSession session) {
        synchronized(session) {
            if(session.getAttribute("workspace")==null) session.setAttribute("workspace",UUID.randomUUID().toString());
            return (String)session.getAttribute("workspace");
        }
    }
    @GetMapping("/comparisons") List<Map<String,Object>> list(HttpSession session) {
        return jobs.findTop30ByOwnerIdOrderByCreatedAtDesc(owner(session)).stream().map(this::summary).toList();
    }
    @PostMapping(value="/comparisons",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<?> upload(@RequestParam MultipartFile original,@RequestParam MultipartFile revised,@RequestParam(defaultValue="mixed") String mode,
                            @RequestParam(defaultValue="true") boolean ignoreWhitespace,@RequestParam(defaultValue="false") boolean normalizeWidth,HttpSession session) throws IOException {
        synchronized(session) {
            checkLimit(owner(session));checkFile(original);checkFile(revised);
            UUID id=UUID.randomUUID();files.directory(id);
            try {
                original.transferTo(files.file(id,"original.pdf"));revised.transferTo(files.file(id,"revised.pdf"));
                engine.validate(files.file(id,"original.pdf"));engine.validate(files.file(id,"revised.pdf"));
                ComparisonJob job=create(id,owner(session),original.getOriginalFilename(),revised.getOriginalFilename(),original.getSize(),revised.getSize(),mode,ignoreWhitespace,normalizeWidth);
                return ResponseEntity.accepted().body(summary(job));
            } catch(Exception e) {files.delete(id);throw e;}
        }
    }
    @PostMapping("/comparisons/demo") ResponseEntity<?> demo(HttpSession session) throws IOException {
        synchronized(session) {
            checkLimit(owner(session));UUID id=UUID.randomUUID();files.directory(id);
            try {
                demo.create(files.file(id,"original.pdf"),false);demo.create(files.file(id,"revised.pdf"),true);
                var job=create(id,owner(session),"お見積書_初版.pdf","お見積書_改訂版.pdf",Files.size(files.file(id,"original.pdf")),Files.size(files.file(id,"revised.pdf")),"mixed",true,false);
                return ResponseEntity.accepted().body(summary(job));
            } catch(Exception e){files.delete(id);throw e;}
        }
    }
    private void checkLimit(String owner) {
        if(jobs.countByOwnerIdAndStatusIn(owner,List.of(ComparisonJob.Status.QUEUED,ComparisonJob.Status.PROCESSING))>=maxActive)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"同時に実行できる比較は3件です。完了をお待ちください。");
    }
    private static void checkFile(MultipartFile f) throws IOException {
        if(f.isEmpty()||f.getSize()>25*1024*1024) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"PDFは1ファイル25MB以内にしてください。");
        try(InputStream in=f.getInputStream()) {
            if(!new String(in.readNBytes(5),StandardCharsets.US_ASCII).equals("%PDF-")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"有効なPDFファイルを選択してください。");
        }
    }
    private ComparisonJob create(UUID id,String owner,String a,String b,long as,long bs,String mode,boolean whitespace,boolean width) {
        if(!Set.of("mixed","text","visual").contains(mode)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"比較モードが無効です。");
        var job=new ComparisonJob();job.id=id;job.ownerId=owner;job.status=ComparisonJob.Status.QUEUED;
        job.originalName=safeName(a);job.revisedName=safeName(b);job.originalSize=as;job.revisedSize=bs;job.mode=mode;
        job.ignoreWhitespace=whitespace;job.normalizeWidth=width;job.createdAt=Instant.now();job.updatedAt=job.createdAt;
        return jobs.save(job);
    }
    private static String safeName(String name) {
        if(name==null)return "document.pdf";
        String safe=name.replaceAll("[\\p{Cntrl}/\\\\]","_");return safe.substring(0,Math.min(240,safe.length()));
    }
    private ComparisonJob owned(UUID id,HttpSession session) {
        return jobs.findByIdAndOwnerId(id,owner(session)).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"比較が見つかりません。保存期間が終了した可能性があります。"));
    }
    private Map<String,Object> summary(ComparisonJob j) {
        Map<String,Object> m=new LinkedHashMap<>();m.put("id",j.id);m.put("status",j.status);m.put("originalName",j.originalName);m.put("revisedName",j.revisedName);m.put("originalSize",j.originalSize);m.put("revisedSize",j.revisedSize);m.put("mode",j.mode);m.put("createdAt",j.createdAt);m.put("progress",j.progress);m.put("pageCount",j.pageCount);m.put("changeCount",j.changeCount);m.put("error",j.errorMessage);return m;
    }
    @GetMapping("/comparisons/{id}") Map<String,Object> get(@PathVariable UUID id,HttpSession session) throws IOException {
        var j=owned(id,session);var m=summary(j);if(j.resultJson!=null)m.put("result",json.readTree(j.resultJson));return m;
    }
    @DeleteMapping("/comparisons/{id}") ResponseEntity<?> delete(@PathVariable UUID id,HttpSession session) throws IOException {
        var j=owned(id,session);
        if(j.status==ComparisonJob.Status.PROCESSING||j.status==ComparisonJob.Status.QUEUED)throw new ResponseStatusException(HttpStatus.CONFLICT,"処理中の比較は完了後に削除できます。");
        files.delete(id);jobs.delete(j);return ResponseEntity.noContent().build();
    }
    @GetMapping("/comparisons/{id}/pages/{side}/{page}") ResponseEntity<?> page(@PathVariable UUID id,@PathVariable String side,@PathVariable int page,HttpSession session) {
        var j=owned(id,session);
        if(!Set.of("original","revised").contains(side)||page<1||page>j.pageCount||j.status!=ComparisonJob.Status.COMPLETED)throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        Path path=files.file(id,side+"-"+page+".png");if(!Files.exists(path))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG).body(new FileSystemResource(path));
    }
    @GetMapping("/comparisons/{id}/report") ResponseEntity<String> report(@PathVariable UUID id,HttpSession session) throws IOException {
        var j=owned(id,session);if(j.resultJson==null)throw new ResponseStatusException(HttpStatus.CONFLICT,"比較が完了していません。");
        var result=json.readValue(j.resultJson,ComparisonResult.class);
        StringBuilder csv=new StringBuilder("\uFEFFページ,種類,変更前,変更後\r\n");
        for(var c:result.changes())csv.append(c.page()).append(',').append(cell(c.kind())).append(',').append(cell(c.before())).append(',').append(cell(c.after())).append("\r\n");
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"sabun-report.csv\"").cacheControl(CacheControl.noStore()).contentType(new MediaType("text","csv",StandardCharsets.UTF_8)).body(csv.toString());
    }
    static String cell(String s){String safe=s.stripLeading().matches("(?s)^[=+@\\-].*")?"'"+s:s;return "\""+safe.replace("\"","\"\"")+"\"";}
}
