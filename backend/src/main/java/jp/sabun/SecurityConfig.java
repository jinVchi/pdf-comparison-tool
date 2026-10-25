package jp.sabun;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

@Configuration
class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityContextRepository securityContexts() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    CsrfTokenRepository csrfTokens() {
        return new HttpSessionCsrfTokenRepository();
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, SecurityContextRepository contexts, CsrfTokenRepository csrf)
            throws Exception {
        return http
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.GET, "/api/health", "/api/session").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/sign-in", "/api/auth/sign-up").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().denyAll())
                .requestCache(c -> c.disable())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((request, response, exception) -> {
                            response.setStatus(401);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"message\":\"ログインしてからご利用ください。\"}");
                        })
                        .accessDeniedHandler((request, response, exception) -> {
                            response.setStatus(403);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"message\":\"セッションを確認できません。もう一度お試しください。\"}");
                        }))
                .securityContext(c -> c.securityContextRepository(contexts))
                .csrf(c -> c.csrfTokenRepository(csrf))
                .logout(l -> l.disable())
                .headers(h -> h
                        .contentSecurityPolicy(c -> c.policyDirectives("default-src 'none'; frame-ancestors 'none'")))
                .build();
    }
}
