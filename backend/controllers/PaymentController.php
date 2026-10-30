<?php

declare(strict_types=1);

function payments_route(PDO $pdo, string $method, string $path): void
{
    if ($method === 'POST' && $path === '/payments') {
        $user = require_role('attendee');
        require_csrf();
        $bookingId = (int)(input()['booking_id'] ?? 0);
        $pdo->beginTransaction();
        $query = $pdo->prepare("SELECT b.id, b.reference, b.total_amount, b.status, e.title FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.id=? AND b.user_id=? FOR UPDATE");
        $query->execute([$bookingId, (int)$user['id']]);
        $booking = $query->fetch();
        if (!$booking || $booking['status'] !== 'pending_payment') {
            $pdo->rollBack();
            respond([], 'Booking cannot be paid.', 409);
        }
        $pdo->prepare("UPDATE payments SET status='succeeded', paid_at=NOW() WHERE booking_id=? AND status='pending'")->execute([$bookingId]);
        $pdo->prepare("UPDATE bookings SET status='confirmed' WHERE id=?")->execute([$bookingId]);
        $pdo->commit();
        notify_user($pdo, (int)$user['id'], 'Booking confirmed', 'Your demo payment for ' . $booking['title'] . ' was recorded.');
        respond(['booking_reference' => $booking['reference'], 'amount' => $booking['total_amount'], 'status' => 'succeeded', 'mode' => 'demo'], 'Demo payment recorded. No real money was charged.');
    }

    if ($method === 'GET' && $path === '/payments') {
        $user = require_user();
        $query = $pdo->prepare('SELECT p.transaction_reference, p.amount, p.status, p.paid_at, b.reference AS booking_reference, e.title FROM payments p JOIN bookings b ON b.id=p.booking_id JOIN events e ON e.id=b.event_id WHERE b.user_id=? ORDER BY p.created_at DESC');
        $query->execute([(int)$user['id']]);
        respond(['payments' => $query->fetchAll()]);
    }

    if ($method === 'GET' && preg_match('#^/payments/(\d+)$#', $path, $match)) {
        $user = require_user();
        $query = $pdo->prepare('SELECT p.transaction_reference, p.amount, p.status, p.paid_at, b.reference AS booking_reference, b.quantity, b.status AS booking_status, e.title, e.event_date, e.start_time, u.name AS attendee FROM payments p JOIN bookings b ON b.id=p.booking_id JOIN events e ON e.id=b.event_id JOIN users u ON u.id=b.user_id WHERE p.id=? AND b.user_id=?');
        $query->execute([(int)$match[1], (int)$user['id']]);
        $payment = $query->fetch();
        if (!$payment) respond([], 'Payment not found.', 404);
        respond(['payment' => $payment]);
    }
}
