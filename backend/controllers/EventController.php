<?php

declare(strict_types=1);

function events_route(PDO $pdo, string $method, string $path): void
{
    if ($method === 'GET' && $path === '/categories') {
        respond(['categories' => $pdo->query('SELECT id, name, slug FROM categories ORDER BY name')->fetchAll()]);
    }

    if ($method === 'GET' && $path === '/events/manage') {
        $user = require_role('organizer', 'admin');
        $statement = $user['role'] === 'admin'
            ? $pdo->query("SELECT e.id, e.title, e.event_date, e.status, e.available_tickets, e.total_tickets, COALESCE(SUM(CASE WHEN b.status='confirmed' THEN b.quantity ELSE 0 END),0) AS tickets_sold, COALESCE(SUM(CASE WHEN b.status='confirmed' THEN b.total_amount ELSE 0 END),0) AS revenue FROM events e LEFT JOIN bookings b ON b.event_id=e.id GROUP BY e.id, e.title, e.event_date, e.status, e.available_tickets, e.total_tickets ORDER BY e.id DESC")
            : $pdo->prepare("SELECT e.id, e.title, e.event_date, e.status, e.available_tickets, e.total_tickets, COALESCE(SUM(CASE WHEN b.status='confirmed' THEN b.quantity ELSE 0 END),0) AS tickets_sold, COALESCE(SUM(CASE WHEN b.status='confirmed' THEN b.total_amount ELSE 0 END),0) AS revenue FROM events e LEFT JOIN bookings b ON b.event_id=e.id WHERE e.organizer_id=? GROUP BY e.id, e.title, e.event_date, e.status, e.available_tickets, e.total_tickets ORDER BY e.id DESC");
        if ($user['role'] !== 'admin') $statement->execute([(int)$user['id']]);
        respond(['events' => $statement->fetchAll()]);
    }

    if ($method === 'GET' && in_array($path, ['/events', '/events/featured'], true)) {
        $where = ["e.status = 'published'", 'e.event_date >= CURDATE()'];
        $params = [];
        foreach (['category' => 'c.slug', 'city' => 'v.city'] as $key => $column) {
            if (!empty($_GET[$key])) {
                $where[] = $key === 'city' ? "$column LIKE ?" : "$column = ?";
                $value = trim((string)$_GET[$key]);
                $params[] = $key === 'city' ? '%' . $value . '%' : $value;
            }
        }
        if (!empty($_GET['q'])) {
            $where[] = '(e.title LIKE ? OR e.description LIKE ? OR v.city LIKE ? OR c.name LIKE ?)';
            $term = '%' . trim((string)$_GET['q']) . '%';
            array_push($params, $term, $term, $term, $term);
        }
        if (!empty($_GET['date'])) {
            $where[] = 'e.event_date = ?';
            $params[] = $_GET['date'];
        }
        $sql = "SELECT e.id, e.title, e.slug, e.description, e.event_date, e.start_time, e.ticket_price, e.available_tickets, e.image_path, c.name AS category, c.slug AS category_slug, v.name AS venue, v.city, u.name AS organizer, (SELECT COALESCE(AVG(r.rating),0) FROM reviews r WHERE r.event_id=e.id AND r.status='approved') AS average_rating, (SELECT COUNT(*) FROM reviews r WHERE r.event_id=e.id AND r.status='approved') AS review_count FROM events e JOIN categories c ON c.id=e.category_id JOIN venues v ON v.id=e.venue_id JOIN users u ON u.id=e.organizer_id WHERE " . implode(' AND ', $where) . ' ORDER BY e.event_date, e.start_time';
        if ($path === '/events/featured') {
            $sql .= ' LIMIT 3';
        }
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        respond(['events' => $statement->fetchAll()]);
    }

    if ($method === 'GET' && preg_match('#^/events/(\d+)$#', $path, $match)) {
        $statement = $pdo->prepare("SELECT e.*, c.name AS category, v.name AS venue, v.address, v.city, u.name AS organizer, (SELECT COALESCE(AVG(r.rating),0) FROM reviews r WHERE r.event_id=e.id AND r.status='approved') AS average_rating, (SELECT COUNT(*) FROM reviews r WHERE r.event_id=e.id AND r.status='approved') AS review_count FROM events e JOIN categories c ON c.id=e.category_id JOIN venues v ON v.id=e.venue_id JOIN users u ON u.id=e.organizer_id WHERE e.id=? AND e.status='published'");
        $statement->execute([(int)$match[1]]);
        $event = $statement->fetch();
        if (!$event) respond([], 'Event not found.', 404);
        $schedule = $pdo->prepare('SELECT starts_at, ends_at, title, details FROM event_schedules WHERE event_id=? ORDER BY starts_at');
        $schedule->execute([$event['id']]);
        $event['schedule'] = $schedule->fetchAll();
        respond(['event' => $event]);
    }

    if ($method === 'POST' && $path === '/events') {
        $user = require_role('organizer', 'admin');
        require_csrf();
        $data = input();
        $title = trim((string)($data['title'] ?? ''));
        $date = (string)($data['event_date'] ?? '');
        $price = filter_var($data['ticket_price'] ?? null, FILTER_VALIDATE_FLOAT);
        $quantity = filter_var($data['total_tickets'] ?? null, FILTER_VALIDATE_INT);
        if ($title === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date < date('Y-m-d') || $price === false || $price < 0 || $quantity === false || $quantity < 1) {
            respond([], 'Check the title, future event date, price, and ticket quantity.', 422);
        }
        $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $title), '-')) . '-' . bin2hex(random_bytes(3));
        $startTime = (string)($data['start_time'] ?? '18:00');
        $endTime = (string)($data['end_time'] ?? '21:00');
        if ($endTime <= $startTime) respond([], 'Event end time must be after its start time.', 422);
        $pdo->beginTransaction();
        try {
            $venueQuery = $pdo->prepare('SELECT capacity FROM venues WHERE id=? FOR UPDATE');
            $venueQuery->execute([(int)($data['venue_id'] ?? 0)]);
            $venue = $venueQuery->fetch();
            if (!$venue || $quantity > (int)$venue['capacity']) {
                $pdo->rollBack();
                respond([], 'Choose a venue with enough capacity.', 422);
            }
            $overlap = $pdo->prepare("SELECT COUNT(*) FROM events WHERE venue_id=? AND event_date=? AND status <> 'cancelled' AND start_time < ? AND end_time > ?");
            $overlap->execute([(int)$data['venue_id'], $date, $endTime, $startTime]);
            if ((int)$overlap->fetchColumn() > 0) {
                $pdo->rollBack();
                respond([], 'That venue already has an event during this time.', 409);
            }
            $statement = $pdo->prepare('INSERT INTO events (organizer_id, category_id, venue_id, title, slug, description, event_date, start_time, end_time, ticket_price, total_tickets, available_tickets, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $statement->execute([(int)$user['id'], (int)($data['category_id'] ?? 0), (int)$data['venue_id'], $title, $slug, trim((string)($data['description'] ?? '')), $date, $startTime, $endTime, $price, $quantity, $quantity, $user['role'] === 'admin' ? 'published' : 'pending']);
            $eventId = (int)$pdo->lastInsertId();
            foreach (($data['schedule'] ?? []) as $item) {
                if (!is_array($item) || empty($item['starts_at']) || empty($item['ends_at']) || empty($item['title'])) continue;
                $pdo->prepare('INSERT INTO event_schedules (event_id, starts_at, ends_at, title, details) VALUES (?, ?, ?, ?, ?)')->execute([$eventId, $item['starts_at'], $item['ends_at'], trim($item['title']), trim((string)($item['details'] ?? ''))]);
            }
            $pdo->commit();
        } catch (PDOException $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ($error->getCode() === '23000') respond([], 'Choose a valid category and venue.', 422);
            throw $error;
        }
        respond(['id' => $eventId, 'status' => $user['role'] === 'admin' ? 'published' : 'pending'], 'Event submitted for review.', 201);
    }

    if ($method === 'POST' && preg_match('#^/events/(\d+)/image$#', $path, $match)) {
        $user = require_role('organizer', 'admin');
        require_csrf();
        $id = (int)$match[1];
        $owner = $pdo->prepare('SELECT organizer_id FROM events WHERE id=?');
        $owner->execute([$id]);
        $event = $owner->fetch();
        if (!$event || ($user['role'] !== 'admin' && (int)$event['organizer_id'] !== (int)$user['id'])) respond([], 'Event not found or not owned by you.', 404);
        $file = $_FILES['image'] ?? null;
        if (!$file || $file['error'] !== UPLOAD_ERR_OK || $file['size'] > 5 * 1024 * 1024) respond([], 'Choose an image smaller than 5 MB.', 422);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($extensions[$mime])) respond([], 'Only JPEG, PNG, and WebP images are accepted.', 422);
        $directory = dirname(__DIR__) . '/uploads';
        if (!is_dir($directory) && !mkdir($directory, 0755, true)) respond([], 'Upload storage is unavailable.', 500);
        $filename = 'event-' . $id . '-' . bin2hex(random_bytes(8)) . '.' . $extensions[$mime];
        if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $filename)) respond([], 'Image could not be saved.', 500);
        $pdo->prepare('UPDATE events SET image_path=? WHERE id=?')->execute(['uploads/' . $filename, $id]);
        respond(['image_path' => 'uploads/' . $filename], 'Event image uploaded.');
    }

    if (preg_match('#^/events/(\d+)$#', $path, $match) && in_array($method, ['PUT', 'DELETE'], true)) {
        $user = require_role('organizer', 'admin');
        require_csrf();
        $id = (int)$match[1];
        $owner = $pdo->prepare('SELECT organizer_id FROM events WHERE id=?');
        $owner->execute([$id]);
        $event = $owner->fetch();
        if (!$event || ($user['role'] !== 'admin' && (int)$event['organizer_id'] !== (int)$user['id'])) respond([], 'Event not found or not owned by you.', 404);
        if ($method === 'DELETE') {
            $pdo->prepare("UPDATE events SET status='cancelled' WHERE id=?")->execute([$id]);
            respond([], 'Event cancelled.');
        }
        $data = input();
        $title = trim((string)($data['title'] ?? ''));
        $date = (string)($data['event_date'] ?? '');
        $start = (string)($data['start_time'] ?? '');
        $end = (string)($data['end_time'] ?? '');
        $price = filter_var($data['ticket_price'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($title === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date < date('Y-m-d') || $start === '' || $end <= $start || $price === false || $price < 0) {
            respond([], 'Check the title, future event date, times, and ticket price.', 422);
        }
        $statement = $pdo->prepare('UPDATE events SET title=?, description=?, event_date=?, start_time=?, end_time=?, ticket_price=? WHERE id=?');
        $statement->execute([$title, trim((string)($data['description'] ?? '')), $date, $start, $end, $price, $id]);
        respond([], 'Event updated.');
    }
}
