<?php
declare(strict_types=1);

function auth_route(PDO $pdo, string $method, string $path): void
{
    if ($method === 'GET' && $path === '/auth/session') {
        $user = $_SESSION['user'] ?? null;
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
        respond(['user' => $user, 'csrf' => $_SESSION['csrf']]);
    }

    if ($method === 'POST' && $path === '/auth/register') {
        $data = input();
        $name = trim((string)($data['name'] ?? ''));
        $email = strtolower(trim((string)($data['email'] ?? '')));
        $password = (string)($data['password'] ?? '');
        if (mb_strlen($name) < 2 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
            respond([], 'Enter a name, valid email, and password with at least 8 characters.', 422);
        }
        $statement = $pdo->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "attendee")');
        try {
            $statement->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                respond([], 'An account with that email already exists.', 409);
            }
            throw $error;
        }
        $id = (int)$pdo->lastInsertId();
        session_regenerate_id(true);
        $_SESSION['user'] = ['id' => $id, 'name' => $name, 'email' => $email, 'role' => 'attendee'];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        notify_user($pdo, $id, 'Welcome to Gather', 'Your attendee account is ready.');
        respond(['user' => $_SESSION['user'], 'csrf' => $_SESSION['csrf']], 'Account created.', 201);
    }

    if ($method === 'POST' && $path === '/auth/login') {
        $data = input();
        $statement = $pdo->prepare('SELECT id, name, email, password_hash, role, status FROM users WHERE email = ? LIMIT 1');
        $statement->execute([strtolower(trim((string)($data['email'] ?? '')))]);
        $record = $statement->fetch();
        if (!$record || $record['status'] !== 'active' || !password_verify((string)($data['password'] ?? ''), $record['password_hash'])) {
            respond([], 'Email or password is incorrect.', 401);
        }
        session_regenerate_id(true);
        unset($record['password_hash'], $record['status']);
        $_SESSION['user'] = $record;
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        respond(['user' => $record, 'csrf' => $_SESSION['csrf']], 'Welcome back.');
    }

    if ($method === 'POST' && $path === '/auth/logout') {
        require_csrf();
        $_SESSION = [];
        session_destroy();
        respond([], 'You have been signed out.');
    }
}