package jp.sabun.auth;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SessionController {
    @GetMapping("/api/session")
    Map<String, Object> session(CsrfToken token) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("csrfToken", token.getToken());
        result.put("csrfHeader", token.getHeaderName());
        result.put("retentionHours", 24);
        result.put("user", WorkspaceIdentity.account());
        return result;
    }
}
