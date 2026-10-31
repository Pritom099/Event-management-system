<?php

declare(strict_types=1);

function wishlist_event_exists(PDO $pdo, int $eventId): bool
{
    $query = $pdo->prepare("SELECT id FROM events WHERE id=? AND status='published'");
    $query->execute([$eventId]);
    return (bool)$query->fetchColumn();
}

function wishlist_contains(PDO $pdo, int $userId, int $eventId): bool
{
    $query = $pdo->prepare('SELECT 1 FROM wishlists WHERE user_id=? AND event_id=? LIMIT 1');
    $query->execute([$userId, $eventId]);
    return (bool)$query->fetchColumn();
}

function wishlist_add(PDO $pdo, int $userId, int $eventId): void
{
    $query = $pdo->prepare('INSERT INTO wishlists (user_id, event_id) VALUES (?, ?)');
    $query->execute([$userId, $eventId]);
}

function wishlist_remove(PDO $pdo, int $userId, int $eventId): int
{
    $query = $pdo->prepare('DELETE FROM wishlists WHERE user_id=? AND event_id=?');
    $query->execute([$userId, $eventId]);
    return $query->rowCount();
}

function wishlist_for_user(PDO $pdo, int $userId): array
{
    $query = $pdo->prepare('SELECT e.id, e.title, e.slug, e.description, e.event_date, e.start_time, e.ticket_price, e.available_tickets, e.image_path, c.name AS category, c.slug AS category_slug, v.name AS venue, v.city, w.created_at AS saved_at FROM wishlists w JOIN events e ON e.id=w.event_id JOIN categories c ON c.id=e.category_id JOIN venues v ON v.id=e.venue_id WHERE w.user_id=? AND e.status="published" ORDER BY w.created_at DESC');
    $query->execute([$userId]);
    return $query->fetchAll();
}
