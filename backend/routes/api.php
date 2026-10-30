<?php

declare(strict_types=1);

function route_api(PDO $pdo, string $method, string $path): void
{
    if ($method === 'POST' && $path === '/contact') {
        require_csrf();
        $data = input();
        $name = trim((string)($data['name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $subject = trim((string)($data['subject'] ?? ''));
        $message = trim((string)($data['message'] ?? ''));
        if (mb_strlen($name) < 2 || !filter_var($email, FILTER_VALIDATE_EMAIL) || $subject === '' || mb_strlen($message) < 10) {
            respond([], 'Enter your name, a valid email, a subject, and a message of at least 10 characters.', 422);
        }
        $pdo->prepare('INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)')->execute([$name, $email, $subject, $message]);
        respond([], 'Your message has been sent to the Gather team.', 201);
    }
    auth_route($pdo, $method, $path);
    events_route($pdo, $method, $path);
    bookings_route($pdo, $method, $path);
    payments_route($pdo, $method, $path);
    venues_route($pdo, $method, $path);
    admin_route($pdo, $method, $path);
    if ($method === 'GET' && $path === '/notifications') {
        $user = require_user();
        $query = $pdo->prepare('SELECT id, title, body, read_at, created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50');
        $query->execute([(int)$user['id']]);
        respond(['notifications' => $query->fetchAll()]);
    }
    if ($method === 'PUT' && preg_match('#^/notifications/(\d+)/read$#', $path, $match)) {
        $user = require_user();
        require_csrf();
        $pdo->prepare('UPDATE notifications SET read_at=NOW() WHERE id=? AND user_id=?')->execute([(int)$match[1], (int)$user['id']]);
        respond([], 'Notification marked as read.');
    }
    respond([], 'Endpoint not found.', 404);
}
