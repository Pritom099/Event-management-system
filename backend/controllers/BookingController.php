<?php

declare(strict_types=1);

function bookings_route(PDO $pdo, string $method, string $path): void
{
    if ($method === 'POST' && $path === '/bookings') {
        $user = require_role('attendee');
        require_csrf();
        $data = input();
        $eventId = (int)($data['event_id'] ?? 0);
        $quantity = filter_var($data['quantity'] ?? null, FILTER_VALIDATE_INT);
        if ($eventId < 1 || $quantity === false || $quantity < 1 || $quantity > 10) respond([], 'Choose between 1 and 10 tickets.', 422);
        $pdo->beginTransaction();
        try {
            $query = $pdo->prepare("SELECT id, ticket_price, available_tickets FROM events WHERE id=? AND status='published' AND event_date >= CURDATE() FOR UPDATE");
            $query->execute([$eventId]);
            $event = $query->fetch();
            if (!$event || (int)$event['available_tickets'] < $quantity) {
                $pdo->rollBack();
                respond([], 'Those tickets are no longer available.', 409);
            }
            $unitPrice = (float)$event['ticket_price'];
            $total = round($unitPrice * $quantity, 2);
            $reference = 'GTH-' . strtoupper(bin2hex(random_bytes(5)));
            $insert = $pdo->prepare('INSERT INTO bookings (reference, user_id, event_id, quantity, unit_price, total_amount) VALUES (?, ?, ?, ?, ?, ?)');
            $insert->execute([$reference, (int)$user['id'], $eventId, $quantity, $unitPrice, $total]);
            $bookingId = (int)$pdo->lastInsertId();
            $pdo->prepare('UPDATE events SET available_tickets=available_tickets-? WHERE id=?')->execute([$quantity, $eventId]);
            $pdo->prepare('INSERT INTO payments (booking_id, transaction_reference, amount) VALUES (?, ?, ?)')->execute([$bookingId, 'DEMO-' . strtoupper(bin2hex(random_bytes(6))), $total]);
            $pdo->commit();
            respond(['id' => $bookingId, 'reference' => $reference, 'quantity' => $quantity, 'total_amount' => $total, 'status' => 'pending_payment'], 'Booking held. Complete demo payment to confirm.', 201);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }

    if ($method === 'GET' && $path === '/bookings') {
        $user = require_user();
        $sql = 'SELECT b.id, b.event_id, b.reference, b.quantity, b.total_amount, b.status, b.created_at, e.title, e.event_date, e.start_time, e.image_path FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.user_id=? ORDER BY b.created_at DESC';
        $query = $pdo->prepare($sql);
        $query->execute([(int)$user['id']]);
        respond(['bookings' => $query->fetchAll()]);
    }

    if ($method === 'PUT' && preg_match('#^/bookings/(\d+)/cancel$#', $path, $match)) {
        $user = require_role('attendee');
        require_csrf();
        $pdo->beginTransaction();
        $query = $pdo->prepare('SELECT b.*, e.event_date, e.start_time FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.id=? AND b.user_id=? FOR UPDATE');
        $query->execute([(int)$match[1], (int)$user['id']]);
        $booking = $query->fetch();
        if (!$booking || $booking['status'] !== 'confirmed' || strtotime($booking['event_date'] . ' ' . $booking['start_time']) <= strtotime('+24 hours')) {
            $pdo->rollBack();
            respond([], 'Only confirmed bookings more than 24 hours before the event can be cancelled.', 409);
        }
        $pdo->prepare("UPDATE bookings SET status='cancelled', cancelled_at=NOW() WHERE id=?")->execute([$booking['id']]);
        $pdo->prepare('UPDATE events SET available_tickets=available_tickets+? WHERE id=?')->execute([$booking['quantity'], $booking['event_id']]);
        $pdo->prepare("UPDATE payments SET status='refunded' WHERE booking_id=? AND status='succeeded'")->execute([$booking['id']]);
        $pdo->commit();
        notify_user($pdo, (int)$user['id'], 'Booking cancelled', 'Your booking ' . $booking['reference'] . ' was cancelled.');
        respond([], 'Booking cancelled. Demo payment status marked refunded.');
    }

    if ($method === 'GET' && preg_match('#^/bookings/(\d+)$#', $path, $match)) {
        $user = require_user();
        $query = $pdo->prepare('SELECT b.*, e.title, e.event_date, e.start_time, e.image_path FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.id=? AND b.user_id=?');
        $query->execute([(int)$match[1], (int)$user['id']]);
        $booking = $query->fetch();
        if (!$booking) respond([], 'Booking not found.', 404);
        respond(['booking' => $booking]);
    }
}
