package jp.sabun;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
            limiter.check(request.getRemoteAddr(), registration);
            String guest = (String) session.getAttribute("workspace");
            WorkspaceIdentity.Account account;
            try {
                account = registration ? auth.register(credentials.email(), credentials.password(), guest)
                        : auth.signIn(credentials.email(), credentials.password(), guest);
            } catch (DataIntegrityViolationException e) {
                // The unique database constraint also handles simultaneous registrations.
                if (registration)
                    throw AuthService.duplicate();
                throw e;
            }
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
        new SecurityContextLogoutHandler().logout(request, response,
                SecurityContextHolder.getContext().getAuthentication());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
