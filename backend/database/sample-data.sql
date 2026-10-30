USE event_management;

-- Local classroom accounts only. All three demo accounts use password: password
INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
  ('Gather Administrator', 'admin@gather.local', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'admin'),
  ('Gather Host', 'host@gather.local', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'organizer'),
  ('Gather Guest', 'guest@gather.local', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'attendee');

UPDATE users
SET password_hash = '$2y$12$lXPyXskGLb1uNHztxCB5Cup3E81YQZSfBxh4lOPNMo4PsczqYrADG', status = 'active'
WHERE email IN ('admin@gather.local', 'host@gather.local', 'guest@gather.local');

INSERT INTO venues (name, address, city, capacity, created_by)
SELECT 'The Glasshouse', '18 Orchard Lane', 'Brooklyn', 180, u.id
FROM users u
WHERE u.email = 'host@gather.local'
  AND NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Glasshouse' AND city = 'Brooklyn');

INSERT INTO venues (name, address, city, capacity, created_by)
SELECT 'Northside Studio', '204 Grove Street', 'Brooklyn', 90, u.id
FROM users u
WHERE u.email = 'host@gather.local'
  AND NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Northside Studio' AND city = 'Brooklyn');

INSERT INTO events (organizer_id, category_id, venue_id, title, slug, description, event_date, start_time, end_time, ticket_price, total_tickets, available_tickets, status)
SELECT u.id, c.id, v.id, 'The Listening Room', 'sample-listening-room', 'An intimate evening of live music, thoughtful conversation, and a shared table.', DATE_ADD(CURDATE(), INTERVAL 14 DAY), '19:00', '21:30', 24.00, 120, 120, 'published'
FROM users u
JOIN categories c ON c.slug = 'music'
JOIN venues v ON v.name = 'The Glasshouse' AND v.city = 'Brooklyn'
WHERE u.email = 'host@gather.local'
  AND NOT EXISTS (SELECT 1 FROM events WHERE slug = 'sample-listening-room');

INSERT INTO events (organizer_id, category_id, venue_id, title, slug, description, event_date, start_time, end_time, ticket_price, total_tickets, available_tickets, status)
SELECT u.id, c.id, v.id, 'Make Space: A Design Workshop', 'sample-design-workshop', 'A hands-on afternoon for curious people who want to make something with their hands.', DATE_ADD(CURDATE(), INTERVAL 21 DAY), '13:00', '16:00', 35.00, 60, 60, 'published'
FROM users u
JOIN categories c ON c.slug = 'design'
JOIN venues v ON v.name = 'Northside Studio' AND v.city = 'Brooklyn'
WHERE u.email = 'host@gather.local'
  AND NOT EXISTS (SELECT 1 FROM events WHERE slug = 'sample-design-workshop');

INSERT INTO events (organizer_id, category_id, venue_id, title, slug, description, event_date, start_time, end_time, ticket_price, total_tickets, available_tickets, image_path, status)
SELECT u.id, c.id, v.id, s.title, s.slug, s.description, DATE_ADD(CURDATE(), INTERVAL s.day_offset DAY), s.start_time, s.end_time, s.price, s.capacity, s.capacity, s.image_url, 'published'
FROM (
  SELECT 'Future Folk: AI and Everyday Life' AS title, 'sample-future-folk' AS slug, 'A friendly, jargon-free evening about the ways new tools are changing how we work and create.' AS description, 'technology' AS category_slug, 'The Glasshouse' AS venue_name, 8 AS day_offset, '18:30' AS start_time, '20:30' AS end_time, 18.00 AS price, 140 AS capacity, 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1000&q=82' AS image_url
  UNION ALL SELECT 'Color in the Wild', 'sample-color-wild', 'A practical color workshop inspired by the city around us. Bring curiosity; materials are included.', 'design', 'Northside Studio', 11, '14:00', '16:30', 32.00, 80, 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1000&q=82'
  UNION ALL SELECT 'Vinyl & Vino', 'sample-vinyl-vino', 'Bring a favorite record or discover something new at an easygoing night of listening and conversation.', 'music', 'The Glasshouse', 16, '19:00', '22:00', 26.00, 110, 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1000&q=82'
  UNION ALL SELECT 'Sunday Table: Seasonal Plates', 'sample-sunday-table', 'A relaxed communal supper celebrating local ingredients and the people who grow them.', 'food-drink', 'Northside Studio', 19, '17:30', '20:00', 42.00, 70, 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=82'
  UNION ALL SELECT 'Small Business, Big Ideas', 'sample-small-business', 'Local founders share honest lessons, useful introductions, and the next steps they wish they knew sooner.', 'business', 'The Glasshouse', 24, '18:00', '20:00', 15.00, 120, 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=82'
  UNION ALL SELECT 'Brooklyn Garden Swap', 'sample-garden-swap', 'Trade cuttings, seeds, and neighborhood growing tips at a welcoming afternoon for plant people.', 'community', 'Northside Studio', 27, '11:00', '13:00', 0.00, 75, 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=82'
  UNION ALL SELECT 'Build Night: Creative Coding', 'sample-build-night', 'Make a tiny interactive project with friendly mentors. Laptops and beginner questions are welcome.', 'technology', 'Northside Studio', 30, '18:30', '21:00', 12.00, 80, 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=82'
  UNION ALL SELECT 'Objects with a Second Life', 'sample-second-life', 'Meet local makers turning overlooked materials into useful, beautiful objects, then try a small project yourself.', 'design', 'The Glasshouse', 33, '13:00', '16:00', 29.00, 100, 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=82'
  UNION ALL SELECT 'Rooftop Sessions: First Light', 'sample-rooftop-sessions', 'An open-air set from emerging local artists, with room to dance or simply listen.', 'music', 'The Glasshouse', 36, '19:30', '22:00', 30.00, 130, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1000&q=82'
  UNION ALL SELECT 'The Neighborhood Pasta Club', 'sample-pasta-club', 'Roll, shape, and share fresh pasta in a hands-on class led by a neighborhood cook.', 'food-drink', 'Northside Studio', 39, '16:00', '19:00', 38.00, 60, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1000&q=82'
) AS s
JOIN users u ON u.email = 'host@gather.local'
JOIN categories c ON c.slug = s.category_slug
JOIN venues v ON v.name = s.venue_name AND v.city = 'Brooklyn'
WHERE NOT EXISTS (SELECT 1 FROM events existing WHERE existing.slug = s.slug);

INSERT INTO event_schedules (event_id, starts_at, ends_at, title, details)
SELECT id, TIMESTAMP(event_date, start_time), DATE_ADD(TIMESTAMP(event_date, start_time), INTERVAL 45 MINUTE), 'Doors & welcome', 'Settle in and meet the host.'
FROM events
WHERE slug = 'sample-listening-room'
  AND NOT EXISTS (SELECT 1 FROM event_schedules WHERE event_id = events.id);