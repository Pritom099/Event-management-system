<?php

declare(strict_types=1);

function valid_review_input(array $data): array
{
    $rating = filter_var($data['rating'] ?? null, FILTER_VALIDATE_INT);
    $comment = trim((string)($data['comment'] ?? ''));
    if ($rating === false || $rating < 1 || $rating > 5 || mb_strlen($comment) > 3000) {
        respond([], 'Rating must be 1–5 and comment must be 3000 characters or fewer.', 422);
    }
    return [$rating, $comment];
}

function reviews_route(PDO $pdo, string $method, string $path): void
{
    if ($method === 'GET' && preg_match('#^/reviews/event/(\d+)/summary$#', $path, $match)) {
        $eventId = (int)$match[1];
        if ($eventId < 1 || !review_event($pdo, $eventId)) respond([], 'Event not found.', 404);
        respond(['summary' => review_summary($pdo, $eventId)]);
    }

    if ($method === 'GET' && preg_match('#^/reviews/event/(\d+)$#', $path, $match)) {
        $eventId = (int)$match[1];
        $event = review_event($pdo, $eventId);
        if ($eventId < 1 || !$event) respond([], 'Event not found.', 404);
        $sessionUser = !empty($_SESSION['user']) ? require_user() : null;
        $userId = $sessionUser ? (int)$sessionUser['id'] : null;
        $showAll = false;
        if ($userId && in_array($sessionUser['role'] ?? '', ['admin', 'organizer'], true)) {
            $showAll = ($sessionUser['role'] === 'admin' || (int)$event['organizer_id'] === $userId);
        }
        $myReview = $userId ? review_by_user_event($pdo, $userId, $eventId) : false;
        $eligibleBooking = ($userId && ($sessionUser['role'] ?? '') === 'attendee') ? review_eligible_booking($pdo, $userId, $eventId) : false;
        respond([
            'reviews' => reviews_for_event($pdo, $eventId, $showAll),
            'summary' => review_summary($pdo, $eventId),
            'my_review' => $myReview ?: null,
            'can_review' => $eligibleBooking !== false,
            'event_ended' => strtotime($event['event_date'] . ' ' . $event['end_time']) < time(),
        ]);
    }

    if ($method === 'GET' && $path === '/reviews/my-reviews') {
        $user = require_role('attendee');
        respond(['reviews' => reviews_for_user($pdo, (int)$user['id'])]);
    }

    if ($method === 'POST' && $path === '/reviews') {
        $user = require_role('attendee');
        require_csrf();
        $data = input();
        $eventId = filter_var($data['event_id'] ?? null, FILTER_VALIDATE_INT);
        if ($eventId === false || $eventId < 1 || !review_event($pdo, $eventId)) respond([], 'Event not found.', 404);
        [$rating, $comment] = valid_review_input($data);
        $bookingId = review_eligible_booking($pdo, (int)$user['id'], $eventId);
        if ($bookingId === false) respond([], 'A confirmed booking with a successful payment is required to review this event.', 403);
        try {
            $query = $pdo->prepare("INSERT INTO reviews (user_id, event_id, booking_id, rating, comment, status) VALUES (?, ?, ?, ?, ?, 'pending')");
            $query->execute([(int)$user['id'], $eventId, $bookingId, $rating, $comment]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') respond([], 'You have already reviewed this event.', 409);
            throw $error;
        }
        respond(['id' => (int)$pdo->lastInsertId(), 'status' => 'pending'], 'Review submitted for organizer approval.', 201);
    }

    if ($method === 'PUT' && preg_match('#^/reviews/(\d+)$#', $path, $match)) {
        $user = require_role('attendee');
        require_csrf();
        [$rating, $comment] = valid_review_input(input());
        $query = $pdo->prepare("UPDATE reviews SET rating=?, comment=?, status='pending' WHERE id=? AND user_id=?");
        $query->execute([$rating, $comment, (int)$match[1], (int)$user['id']]);
        if ($query->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM reviews WHERE id=? AND user_id=?');
            $exists->execute([(int)$match[1], (int)$user['id']]);
            if (!$exists->fetchColumn()) respond([], 'Review not found.', 404);
        }
        respond(['id' => (int)$match[1], 'status' => 'pending'], 'Review updated and sent for organizer approval.');
    }

    if ($method === 'DELETE' && preg_match('#^/reviews/(\d+)$#', $path, $match)) {
        $user = require_role('attendee');
        require_csrf();
        $query = $pdo->prepare('DELETE FROM reviews WHERE id=? AND user_id=?');
        $query->execute([(int)$match[1], (int)$user['id']]);
        if ($query->rowCount() === 0) respond([], 'Review not found.', 404);
        respond([], 'Review deleted.');
    }
}

function organizer_reviews_route(PDO $pdo, string $method, string $path): void
{
    if (!str_starts_with($path, '/organizer/reviews')) return;
    $organizer = require_role('organizer');

    if ($method === 'GET' && $path === '/organizer/reviews') {
        $eventId = null;
        if (isset($_GET['event_id']) && $_GET['event_id'] !== '') {
            $eventId = filter_var($_GET['event_id'], FILTER_VALIDATE_INT);
            if ($eventId === false || $eventId < 1) respond([], 'A valid event ID is required.', 422);
        }
        $status = isset($_GET['status']) && $_GET['status'] !== '' ? (string)$_GET['status'] : null;
        if ($status !== null && !in_array($status, ['approved', 'pending', 'rejected'], true)) respond([], 'Invalid review status filter.', 422);
        respond(['reviews' => reviews_for_organizer($pdo, (int)$organizer['id'], $eventId, $status)]);
    }

    if ($method === 'PATCH' && preg_match('#^/organizer/reviews/(\d+)/status$#', $path, $match)) {
        require_csrf();
        $status = (string)(input()['status'] ?? '');
        if (!in_array($status, ['approved', 'pending', 'rejected'], true)) respond([], 'Choose approved, pending, or rejected.', 422);
        $query = $pdo->prepare('UPDATE reviews r JOIN events e ON e.id=r.event_id SET r.status=? WHERE r.id=? AND e.organizer_id=?');
        $query->execute([$status, (int)$match[1], (int)$organizer['id']]);
        if ($query->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT r.id FROM reviews r JOIN events e ON e.id=r.event_id WHERE r.id=? AND e.organizer_id=?');
            $exists->execute([(int)$match[1], (int)$organizer['id']]);
            if (!$exists->fetchColumn()) respond([], 'Review not found for your events.', 404);
        }
        respond(['id' => (int)$match[1], 'status' => $status], 'Review permission updated.');
    }
}

function admin_reviews_route(PDO $pdo, string $method, string $path): void
{
    if (!str_starts_with($path, '/admin/reviews')) return;
    require_role('admin');

    if ($method === 'GET' && $path === '/admin/reviews') {
        $eventId = null;
        if (isset($_GET['event_id']) && $_GET['event_id'] !== '') {
            $eventId = filter_var($_GET['event_id'], FILTER_VALIDATE_INT);
            if ($eventId === false || $eventId < 1) respond([], 'A valid event ID is required.', 422);
        }
        $status = isset($_GET['status']) && $_GET['status'] !== '' ? (string)$_GET['status'] : null;
        if ($status !== null && !in_array($status, ['approved', 'pending', 'rejected'], true)) respond([], 'Invalid review status filter.', 422);
        respond(['reviews' => reviews_for_admin($pdo, $eventId, $status)]);
    }

    if ($method === 'PATCH' && preg_match('#^/admin/reviews/(\d+)/status$#', $path, $match)) {
        require_csrf();
        $status = (string)(input()['status'] ?? '');
        if (!in_array($status, ['approved', 'pending', 'rejected'], true)) respond([], 'Choose approved, pending, or rejected.', 422);
        $query = $pdo->prepare('UPDATE reviews SET status=? WHERE id=?');
        $query->execute([$status, (int)$match[1]]);
        if ($query->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM reviews WHERE id=?');
            $exists->execute([(int)$match[1]]);
            if (!$exists->fetchColumn()) respond([], 'Review not found.', 404);
        }
        respond(['id' => (int)$match[1], 'status' => $status], 'Review moderation saved.');
    }

    if ($method === 'DELETE' && preg_match('#^/admin/reviews/(\d+)$#', $path, $match)) {
        require_csrf();
        $query = $pdo->prepare('DELETE FROM reviews WHERE id=?');
        $query->execute([(int)$match[1]]);
        if ($query->rowCount() === 0) respond([], 'Review not found.', 404);
        respond([], 'Review removed.');
    }
}
