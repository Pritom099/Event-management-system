<?php

declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $localConfigPath = __DIR__ . '/database.local.php';
    $localConfig = is_file($localConfigPath) ? require $localConfigPath : [];
    if (!is_array($localConfig)) {
        $localConfig = [];
    }
    $host = $localConfig['DB_HOST'] ?? (getenv('DB_HOST') ?: '127.0.0.1');
    $name = $localConfig['DB_NAME'] ?? (getenv('DB_NAME') ?: 'event_management');
    $user = $localConfig['DB_USER'] ?? (getenv('DB_USER') ?: 'root');
    $password = $localConfig['DB_PASSWORD'] ?? (getenv('DB_PASSWORD') ?: '');
    $pdo = new PDO(
        "mysql:host={$host};dbname={$name};charset=utf8mb4",
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    return $pdo;
}
