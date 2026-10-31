<?php

declare(strict_types=1);

require __DIR__ . '/middleware/http.php';
require __DIR__ . '/config/database.php';
require __DIR__ . '/models/Wishlist.php';
require __DIR__ . '/models/Review.php';
require __DIR__ . '/controllers/AuthController.php';
require __DIR__ . '/controllers/EventController.php';
require __DIR__ . '/controllers/BookingController.php';
require __DIR__ . '/controllers/PaymentController.php';
require __DIR__ . '/controllers/VenueController.php';
require __DIR__ . '/controllers/AdminController.php';
require __DIR__ . '/controllers/WishlistController.php';
require __DIR__ . '/controllers/ReviewController.php';
require __DIR__ . '/routes/api.php';

header('Access-Control-Allow-Origin: ' . (getenv('APP_ORIGIN') ?: 'http://localhost'));
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

ini_set('session.use_strict_mode', '1');
$isHttps = isset($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off';
session_set_cookie_params(['httponly' => true, 'secure' => $isHttps, 'samesite' => 'Lax', 'path' => '/']);
session_start();

try {
    $requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $scriptPath = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
    if ($scriptPath !== '/' && str_starts_with($requestPath, $scriptPath)) {
        $requestPath = substr($requestPath, strlen($scriptPath));
    }
    $requestPath = preg_replace('#^/index\.php#', '', $requestPath) ?: '/';
    $requestPath = preg_replace('#^/api#', '', $requestPath) ?: '/';
    route_api(db(), $_SERVER['REQUEST_METHOD'], rtrim($requestPath, '/') ?: '/');
} catch (Throwable $error) {
    error_log((string)$error);
    respond([], 'The server could not complete this request.', 500);
}
