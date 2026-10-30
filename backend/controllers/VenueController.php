<?php
declare(strict_types=1);

function venues_route(PDO $pdo, string $method, string $path): void
{
    if ($method === 'GET' && $path === '/venues') {
        $query = $pdo->query('SELECT v.id, v.name, v.address, v.city, v.capacity, u.name AS created_by FROM venues v JOIN users u ON u.id=v.created_by ORDER BY v.city, v.name');
        respond(['venues' => $query->fetchAll()]);
    }
    if ($method === 'POST' && $path === '/venues') {
        $user = require_role('organizer', 'admin');
        require_csrf();
        $data = input();
        $capacity = filter_var($data['capacity'] ?? null, FILTER_VALIDATE_INT);
        if (trim((string)($data['name'] ?? '')) === '' || trim((string)($data['address'] ?? '')) === '' || trim((string)($data['city'] ?? '')) === '' || $capacity === false || $capacity < 1) respond([], 'Enter venue details and a positive capacity.', 422);
        $pdo->prepare('INSERT INTO venues (name, address, city, capacity, created_by) VALUES (?, ?, ?, ?, ?)')->execute([trim($data['name']), trim($data['address']), trim($data['city']), $capacity, (int)$user['id']]);
        respond(['id' => (int)$pdo->lastInsertId()], 'Venue added.', 201);
    }
    if (preg_match('#^/venues/(\d+)$#', $path, $match) && in_array($method, ['PUT', 'DELETE'], true)) {
        $user = require_role('organizer', 'admin');
        require_csrf();
        $id = (int)$match[1];
        $owner = $pdo->prepare('SELECT created_by FROM venues WHERE id=?');
        $owner->execute([$id]);
        $venue = $owner->fetch();
        if (!$venue || ($user['role'] !== 'admin' && (int)$venue['created_by'] !== (int)$user['id'])) respond([], 'Venue not found or not owned by you.', 404);
        if ($method === 'DELETE') {
            $used = $pdo->prepare('SELECT COUNT(*) FROM events WHERE venue_id=?');
            $used->execute([$id]);
            if ((int)$used->fetchColumn() > 0) respond([], 'Venue is attached to events and cannot be deleted.', 409);
            $pdo->prepare('DELETE FROM venues WHERE id=?')->execute([$id]);
            respond([], 'Venue removed.');
        }
        $data = input();
        $pdo->prepare('UPDATE venues SET name=?, address=?, city=?, capacity=? WHERE id=?')->execute([trim((string)($data['name'] ?? '')), trim((string)($data['address'] ?? '')), trim((string)($data['city'] ?? '')), max(1, (int)($data['capacity'] ?? 1)), $id]);
        respond([], 'Venue updated.');
    }
}