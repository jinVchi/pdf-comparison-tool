package jp.sabun;

import jakarta.servlet.http.HttpSession;
import java.io.Serializable;
import java.security.Principal;
import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;

final class WorkspaceIdentity {
    record Account(UUID id, String email) implements Principal, Serializable {
        @Override
        @com.fasterxml.jackson.annotation.JsonIgnore
        public String getName() {
            return id.toString();
        }

        String ownerId() {
            return "user:" + id;
        }
    }

    static Account account() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof Account account ? account : null;
    }

    static String owner(HttpSession session) {
        var account = account();
        if (account != null)
            return account.ownerId();
        synchronized (session) {
            if (session.getAttribute("workspace") == null)
                session.setAttribute("workspace", UUID.randomUUID().toString());
            return (String) session.getAttribute("workspace");
        }
    }
}
