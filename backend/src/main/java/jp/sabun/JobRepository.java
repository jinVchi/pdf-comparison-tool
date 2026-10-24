package jp.sabun;

import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

interface JobRepository extends JpaRepository<ComparisonJob, UUID> {
    List<ComparisonJob> findTop30ByOwnerIdOrderByCreatedAtDesc(String ownerId);

    Optional<ComparisonJob> findByIdAndOwnerId(UUID id, String ownerId);

    long countByOwnerIdAndStatusIn(String ownerId, Collection<ComparisonJob.Status> statuses);

    @Modifying
    @Transactional
    @Query(value = "update comparison_job set owner_id = :account where owner_id = :guest", nativeQuery = true)
    int transferGuest(@Param("guest") String guest, @Param("account") String account);

    @Query("select j from ComparisonJob j where j.status = 'QUEUED' and (j.dispatchedAt is null or j.dispatchedAt < :cutoff) order by j.createdAt")
    List<ComparisonJob> pending(@Param("cutoff") Instant cutoff, org.springframework.data.domain.Pageable page);

    @Modifying
    @Transactional
    @Query("update ComparisonJob j set j.status = 'PROCESSING', j.updatedAt = :now where j.id = :id and j.status = 'QUEUED'")
    int claim(@Param("id") UUID id, @Param("now") Instant now);

    List<ComparisonJob> findByUpdatedAtBeforeAndStatus(Instant cutoff, ComparisonJob.Status status);

    List<ComparisonJob> findByCreatedAtBeforeAndStatusIn(Instant cutoff, Collection<ComparisonJob.Status> statuses);
}
