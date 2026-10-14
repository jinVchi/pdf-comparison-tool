package jp.sabun;

import java.io.IOException;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(ResponseStatusException.class) ResponseEntity<?> status(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message",e.getReason()==null?"リクエストを処理できませんでした。":e.getReason()));
    }
    @ExceptionHandler(MaxUploadSizeExceededException.class) ResponseEntity<?> size() {
        return ResponseEntity.status(413).body(Map.of("message","PDFは1ファイル25MB以内にしてください。"));
    }
    @ExceptionHandler(IOException.class) ResponseEntity<?> pdf(IOException e) {
        return ResponseEntity.badRequest().body(Map.of("message","PDFを読み込めませんでした。パスワード保護・ページ数（最大60）・ファイルの破損をご確認ください。"));
    }
}
