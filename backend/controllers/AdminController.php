<?php

declare(strict_types=1);

function admin_route(PDO $pdo, string $method, string $path): void
{
    if (!str_starts_with($path, '/admin/')) return;
    $admin = require_role('admin');
    if ($method === 'GET' && $path === '/admin/dashboard') {
        $stats = [
            'users' => (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='attendee'")->fetchColumn(),
            'organizers' => (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='organizer'")->fetchColumn(),
            'events' => (int)$pdo->query("SELECT COUNT(*) FROM events WHERE status='published'")->fetchColumn(),
            'bookings' => (int)$pdo->query("SELECT COUNT(*) FROM bookings WHERE status='confirmed'")->fetchColumn(),
            'revenue' => (float)$pdo->query("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='succeeded'")->fetchColumn(),
            'pending_events' => (int)$pdo->query("SELECT COUNT(*) FROM events WHERE status='pending'")->fetchColumn(),
        ];
        $recent = $pdo->query('SELECT b.reference, b.total_amount, b.status, b.created_at, e.title, u.name AS attendee FROM bookings b JOIN events e ON e.id=b.event_id JOIN users u ON u.id=b.user_id ORDER BY b.created_at DESC LIMIT 8')->fetchAll();
        respond(['stats' => $stats, 'recent_bookings' => $recent]);
    }
    if ($method === 'GET' && $path === '/admin/users') {
        respond(['users' => $pdo->query('SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 200')->fetchAll()]);
    }
    if ($method === 'GET' && $path === '/admin/events') {
        respond(['events' => $pdo->query("SELECT e.id, e.title, e.event_date, e.status, u.name AS organizer FROM events e JOIN users u ON u.id=e.organizer_id ORDER BY e.created_at DESC LIMIT 200")->fetchAll()]);
    }
    if ($method === 'GET' && $path === '/admin/payments') {
        respond(['payments' => $pdo->query('SELECT p.transaction_reference, p.amount, p.status, p.paid_at, b.reference AS booking_reference, e.title, u.name AS attendee FROM payments p JOIN bookings b ON b.id=p.booking_id JOIN events e ON e.id=b.event_id JOIN users u ON u.id=b.user_id ORDER BY p.created_at DESC LIMIT 200')->fetchAll()]);
    }
    if ($method === 'GET' && $path === '/admin/messages') {
        respond(['messages' => $pdo->query('SELECT id, name, email, subject, message, status, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200')->fetchAll()]);
    }
    if ($method === 'GET' && $path === '/admin/reports') {
        $monthly = $pdo->query("SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS bookings FROM bookings GROUP BY month ORDER BY month DESC LIMIT 12")->fetchAll();
        $revenue = $pdo->query("SELECT DATE_FORMAT(paid_at,'%Y-%m') AS month, SUM(amount) AS revenue FROM payments WHERE status='succeeded' AND paid_at IS NOT NULL GROUP BY month ORDER BY month DESC LIMIT 12")->fetchAll();
        $popular = $pdo->query("SELECT e.title, COALESCE(SUM(b.quantity),0) AS tickets FROM events e LEFT JOIN bookings b ON b.event_id=e.id AND b.status='confirmed' GROUP BY e.id, e.title ORDER BY tickets DESC LIMIT 8")->fetchAll();
        respond(['monthly_bookings' => array_reverse($monthly), 'monthly_revenue' => array_reverse($revenue), 'popular_events' => $popular]);
    }
    if ($method === 'PUT' && preg_match('#^/admin/events/(\d+)/status$#', $path, $match)) {
        require_csrf();
        $status = (string)(input()['status'] ?? '');
        if (!in_array($status, ['published', 'rejected'], true)) respond([], 'Choose published or rejected.', 422);
        $pdo->prepare('UPDATE events SET status=? WHERE id=? AND status="pending"')->execute([$status, (int)$match[1]]);
        respond([], 'Event review saved.');
    }
    if ($method === 'PUT' && preg_match('#^/admin/users/(\d+)/status$#', $path, $match)) {
        require_csrf();
        $status = (string)(input()['status'] ?? '');
        if (!in_array($status, ['active', 'suspended'], true) || (int)$match[1] === (int)$admin['id']) respond([], 'Invalid account status.', 422);
        $pdo->prepare('UPDATE users SET status=? WHERE id=?')->execute([$status, (int)$match[1]]);
        respond([], 'Account status updated.');
    }
    if ($method === 'POST' && $path === '/admin/categories') {
        require_csrf();
        $data = input();
        $name = trim((string)($data['name'] ?? ''));
        $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $name), '-'));
        if ($name === '' || $slug === '') respond([], 'Enter a category name.', 422);
        try {
            $pdo->prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)')->execute([$name, $slug, trim((string)($data['description'] ?? ''))]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') respond([], 'That category already exists.', 409);
            throw $error;
        }
        respond(['id' => (int)$pdo->lastInsertId()], 'Category created.', 201);
    }
    if ($method === 'DELETE' && preg_match('#^/admin/categories/(\d+)$#', $path, $match)) {
        require_csrf();
        try {
            $pdo->prepare('DELETE FROM categories WHERE id=?')->execute([(int)$match[1]]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') respond([], 'Category is in use by an event.', 409);
            throw $error;
        }
        respond([], 'Category removed.');
    }
}
