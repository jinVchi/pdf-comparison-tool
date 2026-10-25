package jp.sabun.auth;

import jp.sabun.comparison.JobRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class AuthService {
    private final UserRepository users;
    private final JobRepository jobs;
    private final PasswordEncoder passwords;
    private final String dummyHash;

    AuthService(UserRepository users, JobRepository jobs, PasswordEncoder passwords) {
        this.users = users;
        this.jobs = jobs;
        this.passwords = passwords;
        this.dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    @Transactional
    WorkspaceIdentity.Account register(String email, String password, String guest) {
        email = normalizeEmail(email);
        validatePassword(password);
        if (users.findByEmail(email).isPresent())
            throw duplicate();
        var user = new UserAccount();
        user.id = UUID.randomUUID();
        user.email = email;
        user.passwordHash = passwords.encode(password);
        user.createdAt = Instant.now();
        users.saveAndFlush(user);
        return attach(user, guest);
    }

    @Transactional
    WorkspaceIdentity.Account signIn(String email, String password, String guest) {
        email = normalizeEmail(email);
        // Also validate the byte limit on login: BCrypt must never silently truncate passwords.
        if (password == null || password.isEmpty() || password.length() > 72
                || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw invalidCredentials();
        var user = users.findByEmail(email).orElse(null);
        boolean matches = passwords.matches(password, user == null ? dummyHash : user.passwordHash);
        if (user == null || !matches)
            throw invalidCredentials();
        return attach(user, guest);
    }

    private WorkspaceIdentity.Account attach(UserAccount user, String guest) {
        var account = new WorkspaceIdentity.Account(user.id, user.email);
        if (guest != null)
            jobs.transferGuest(guest, account.ownerId());
        return account;
    }

    static String normalizeEmail(String email) {
        if (email == null || email.length() > 254)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "有効なメールアドレスを入力してください。");
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "有効なメールアドレスを入力してください。");
        return normalized;
    }

    private static void validatePassword(String password) {
        if (password == null || password.codePointCount(0, password.length()) < 12 || password.length() > 72
                || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "パスワードは12文字以上、UTF-8で72バイト以内にしてください。");
    }

    static ResponseStatusException duplicate() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "このメールアドレスは登録済みです。ログインしてください。");
    }

    private static ResponseStatusException invalidCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "メールアドレスまたはパスワードが正しくありません。");
    }
}
