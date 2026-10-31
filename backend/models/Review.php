<?php

declare(strict_types=1);

function review_event(PDO $pdo, int $eventId): array|false
{
    $query = $pdo->prepare('SELECT id, organizer_id, title, event_date, end_time FROM events WHERE id=?');
    $query->execute([$eventId]);
    return $query->fetch();
}

function review_eligible_booking(PDO $pdo, int $userId, int $eventId): int|false
{
    $query = $pdo->prepare("SELECT b.id FROM bookings b WHERE b.user_id=? AND b.event_id=? AND b.status='confirmed' AND EXISTS (SELECT 1 FROM payments p WHERE p.booking_id=b.id AND p.status='succeeded') ORDER BY b.id DESC LIMIT 1");
    $query->execute([$userId, $eventId]);
    $bookingId = $query->fetchColumn();
    return $bookingId === false ? false : (int)$bookingId;
}

function review_by_user_event(PDO $pdo, int $userId, int $eventId): array|false
{
    $query = $pdo->prepare('SELECT id, user_id, event_id, booking_id, rating, comment, status, created_at, updated_at FROM reviews WHERE user_id=? AND event_id=? LIMIT 1');
    $query->execute([$userId, $eventId]);
    return $query->fetch();
}

function reviews_for_event(PDO $pdo, int $eventId, bool $includeUnapproved = false): array
{
    $statusFilter = $includeUnapproved ? '' : "AND r.status='approved'";
    $query = $pdo->prepare("SELECT r.id, r.user_id, r.rating, r.comment, r.status, r.created_at, r.updated_at, u.name AS reviewer FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.event_id=? $statusFilter ORDER BY r.created_at DESC");
    $query->execute([$eventId]);
    return $query->fetchAll();
}

function review_summary(PDO $pdo, int $eventId): array
{
    $query = $pdo->prepare("SELECT COUNT(*) AS total, COALESCE(AVG(rating),0) AS average FROM reviews WHERE event_id=? AND status='approved'");
    $query->execute([$eventId]);
    $summary = $query->fetch();
    $distribution = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
    $ratings = $pdo->prepare("SELECT rating, COUNT(*) AS total FROM reviews WHERE event_id=? AND status='approved' GROUP BY rating");
    $ratings->execute([$eventId]);
    foreach ($ratings->fetchAll() as $row) {
        $distribution[(int)$row['rating']] = (int)$row['total'];
    }
    return ['average' => round((float)$summary['average'], 1), 'total' => (int)$summary['total'], 'distribution' => $distribution];
}

function reviews_for_user(PDO $pdo, int $userId): array
{
    $query = $pdo->prepare('SELECT r.id, r.event_id, r.booking_id, r.rating, r.comment, r.status, r.created_at, r.updated_at, e.title, e.event_date, e.start_time, e.image_path, c.name AS category, v.name AS venue, v.city FROM reviews r JOIN events e ON e.id=r.event_id JOIN categories c ON c.id=e.category_id JOIN venues v ON v.id=e.venue_id WHERE r.user_id=? ORDER BY r.updated_at DESC');
    $query->execute([$userId]);
    return $query->fetchAll();
}

function reviews_for_admin(PDO $pdo, ?int $eventId, ?string $status): array
{
    $where = [];
    $params = [];
    if ($eventId !== null) {
        $where[] = 'r.event_id=?';
        $params[] = $eventId;
    }
    if ($status !== null) {
        $where[] = 'r.status=?';
        $params[] = $status;
    }
    $sql = 'SELECT r.id, r.event_id, r.booking_id, r.rating, r.comment, r.status, r.created_at, r.updated_at, e.title AS event_title, u.name AS reviewer, u.email FROM reviews r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=r.user_id';
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY r.created_at DESC LIMIT 500';
    $query = $pdo->prepare($sql);
    $query->execute($params);
    return $query->fetchAll();
}

function reviews_for_organizer(PDO $pdo, int $organizerId, ?int $eventId, ?string $status): array
{
    $where = ['e.organizer_id=?'];
    $params = [$organizerId];
    if ($eventId !== null) {
        $where[] = 'r.event_id=?';
        $params[] = $eventId;
    }
    if ($status !== null) {
        $where[] = 'r.status=?';
        $params[] = $status;
    }
    $sql = 'SELECT r.id, r.event_id, r.booking_id, r.rating, r.comment, r.status, r.created_at, r.updated_at, e.title AS event_title, u.name AS reviewer, u.email FROM reviews r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=r.user_id WHERE ' . implode(' AND ', $where) . ' ORDER BY r.created_at DESC LIMIT 500';
    $query = $pdo->prepare($sql);
    $query->execute($params);
    return $query->fetchAll();
}
