package jp.sabun.auth;

import java.io.Serializable;
import java.security.Principal;
import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class WorkspaceIdentity {
    public record Account(UUID id, String email) implements Principal, Serializable {
        @Override
        @com.fasterxml.jackson.annotation.JsonIgnore
        public String getName() {
            return id.toString();
        }

        String ownerId() {
            return "user:" + id;
        }
    }

    public static Account account() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof Account account ? account : null;
    }

    public static String owner() {
        var account = account();
        if (account == null)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "ログインしてからご利用ください。");
        return account.ownerId();
    }
}
