package jp.sabun;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_user")
class UserAccount {
    @Id
    UUID id;
    @Column(nullable = false, unique = true, length = 254)
    String email;
    @Column(nullable = false, length = 100)
    String passwordHash;
    @Column(nullable = false)
    Instant createdAt;
}
