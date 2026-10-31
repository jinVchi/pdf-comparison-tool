package jp.sabun.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
class AuthController {
    record Credentials(String email, String password) {}

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService auth;
    private final AuthRateLimiter limiter;
    private final SecurityContextRepository contexts;
    private final CsrfTokenRepository csrf;

    AuthController(AuthService auth, AuthRateLimiter limiter, SecurityContextRepository contexts,
            CsrfTokenRepository csrf) {
        this.auth = auth;
        this.limiter = limiter;
        this.contexts = contexts;
        this.csrf = csrf;
    }

    @PostMapping("/sign-up")
    ResponseEntity<WorkspaceIdentity.Account> register(@RequestBody Credentials credentials,
            HttpServletRequest request, HttpServletResponse response) {
        return authenticate(credentials, request, response, true);
    }

    @PostMapping("/sign-in")
    ResponseEntity<WorkspaceIdentity.Account> signIn(@RequestBody Credentials credentials,
            HttpServletRequest request, HttpServletResponse response) {
        return authenticate(credentials, request, response, false);
    }

    private ResponseEntity<WorkspaceIdentity.Account> authenticate(Credentials credentials,
            HttpServletRequest request, HttpServletResponse response, boolean registration) {
        var session = request.getSession();
        synchronized (session) {
            if (WorkspaceIdentity.account() != null || contexts.containsContext(request))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "別のアカウントを使うには、ログアウトしてください。");
            String event = registration ? "auth.sign_up" : "auth.sign_in";
            String address = request.getRemoteAddr();
            try {
                limiter.check(address, registration);
            } catch (ResponseStatusException e) {
                log.warn("{} outcome=rate_limited ip={}", event, address);
                throw e;
            }
            // Preserve history from guest sessions created by older versions. New sessions have no guest workspace.
            String guest = (String) session.getAttribute("workspace");
            WorkspaceIdentity.Account account;
            try {
                try {
                    account = registration ? auth.register(credentials.email(), credentials.password(), guest)
                            : auth.signIn(credentials.email(), credentials.password(), guest);
                } catch (DataIntegrityViolationException e) {
                    // The unique database constraint also handles simultaneous registrations.
                    if (registration)
                        throw AuthService.duplicate();
                    throw e;
                }
            } catch (ResponseStatusException e) {
                log.info("{} outcome=failure status={} email={} ip={}", event, e.getStatusCode().value(),
                        maskEmail(credentials.email()), address);
                throw e;
            }
            log.info("{} outcome=success userId={} ip={}", event, account.id(), address);
            var authentication = UsernamePasswordAuthenticationToken.authenticated(account, null,
                    AuthorityUtils.createAuthorityList("ROLE_USER"));
            new ChangeSessionIdAuthenticationStrategy().onAuthentication(authentication, request, response);
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            contexts.saveContext(context, request, response);
            session.removeAttribute("workspace");
            csrf.saveToken(null, request, response);
            return ResponseEntity.status(registration ? HttpStatus.CREATED : HttpStatus.OK)
                    .cacheControl(CacheControl.noStore()).body(account);
        }
    }

    @PostMapping("/sign-out")
    ResponseEntity<Void> signOut(HttpServletRequest request, HttpServletResponse response) {
        var account = WorkspaceIdentity.account();
        if (account != null)
            log.info("auth.sign_out userId={}", account.id());
        new SecurityContextLogoutHandler().logout(request, response,
                SecurityContextHolder.getContext().getAuthentication());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    /** Keeps failed attempts traceable by domain without storing the address or allowing log injection. */
    static String maskEmail(String email) {
        if (email == null)
            return "-";
        String trimmed = email.strip();
        int at = trimmed.lastIndexOf('@');
        if (at < 1)
            return "invalid";
        String domain = trimmed.substring(at + 1).replaceAll("[^A-Za-z0-9.-]", "?");
        return trimmed.substring(0, 1).replaceAll("[^A-Za-z0-9]", "?") + "***@"
                + domain.substring(0, Math.min(64, domain.length()));
    }
}
