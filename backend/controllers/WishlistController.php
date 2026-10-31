<?php

declare(strict_types=1);

function wishlist_route(PDO $pdo, string $method, string $path): void
{
    if ($method === 'GET' && $path === '/wishlist') {
        $user = require_user();
        respond(['events' => wishlist_for_user($pdo, (int)$user['id'])]);
    }

    if ($method === 'GET' && preg_match('#^/wishlist/check/(\d+)$#', $path, $match)) {
        $user = require_user();
        $eventId = (int)$match[1];
        if ($eventId < 1 || !wishlist_event_exists($pdo, $eventId)) respond([], 'Event not found.', 404);
        respond(['saved' => wishlist_contains($pdo, (int)$user['id'], $eventId)]);
    }

    if ($method === 'POST' && $path === '/wishlist') {
        $user = require_user();
        require_csrf();
        $data = input();
        $eventId = filter_var($data['event_id'] ?? null, FILTER_VALIDATE_INT);
        if ($eventId === false || $eventId < 1) respond([], 'A valid event ID is required.', 422);
        if (!wishlist_event_exists($pdo, $eventId)) respond([], 'Published event not found.', 404);
        try {
            wishlist_add($pdo, (int)$user['id'], $eventId);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') respond([], 'This event is already in your wishlist.', 409);
            throw $error;
        }
        respond(['event_id' => $eventId, 'saved' => true], 'Event added to your wishlist.', 201);
    }

    if ($method === 'DELETE' && preg_match('#^/wishlist/(\d+)$#', $path, $match)) {
        $user = require_user();
        require_csrf();
        $eventId = (int)$match[1];
        if ($eventId < 1) respond([], 'A valid event ID is required.', 422);
        if (wishlist_remove($pdo, (int)$user['id'], $eventId) === 0) respond([], 'Event was not in your wishlist.', 404);
        respond(['event_id' => $eventId, 'saved' => false], 'Event removed from your wishlist.');
    }
}
