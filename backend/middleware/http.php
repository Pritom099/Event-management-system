<?php

declare(strict_types=1);

function respond(array $data = [], string $message = 'Operation successful', int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => $status < 400, 'message' => $message, 'data' => $data], JSON_UNESCAPED_SLASHES);
    exit;
}

function input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return $_POST;
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        respond([], 'Request body must be valid JSON.', 400);
    }
    return $data;
}

function require_user(): array
{
    if (empty($_SESSION['user'])) {
        respond([], 'Please sign in to continue.', 401);
    }
    $statement = db()->prepare("SELECT id, name, email, role, status FROM users WHERE id=? LIMIT 1");
    $statement->execute([(int)$_SESSION['user']['id']]);
    $user = $statement->fetch();
    if (!$user || $user['status'] !== 'active') {
        unset($_SESSION['user']);
        respond([], 'Your account is unavailable. Please sign in again.', 401);
    }
    unset($user['status']);
    $_SESSION['user'] = $user;
    return $user;
}

function require_role(string ...$roles): array
{
    $user = require_user();
    if (!in_array($user['role'], $roles, true)) {
        respond([], 'You do not have permission to perform this action.', 403);
    }
    return $user;
}

function notify_user(PDO $pdo, int $userId, string $title, string $body): void
{
    $statement = $pdo->prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)');
    $statement->execute([$userId, $title, $body]);
}

function require_csrf(): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!isset($_SESSION['csrf']) || !is_string($token) || !hash_equals($_SESSION['csrf'], $token)) {
        respond([], 'Your session token is missing or expired. Refresh and try again.', 419);
    }
}
