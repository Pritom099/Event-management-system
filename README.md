# Gather | Event Management System

Gather is an academic event discovery and management application with a plain HTML/CSS/JavaScript frontend and a Core PHP + MySQL JSON API. The frontend and backend are separate. No frontend or backend framework is used.

## Stack

- HTML5, CSS3, vanilla JavaScript, Fetch API, Font Awesome, Google Fonts
- PHP 8.0+, PDO, PHP sessions
- MySQL 8.0+ / MariaDB compatible InnoDB database
- XAMPP / Apache for local development

## Structure

```text
frontend/                 Public pages, dashboards, styles, and browser code
backend/config/           PDO configuration
backend/controllers/      Auth, events, bookings, payments, venues, admin
backend/database/         Schema and optional local sample data
backend/middleware/       JSON, session, CSRF, and role helpers
backend/routes/           API dispatcher
backend/uploads/          Organizer event images (created on first upload)
backend/index.php         API entry point
```

## XAMPP Setup

1. Start Apache and MySQL from the XAMPP Control Panel.
2. Make this project available beneath Apache's document root. The simplest setup is to copy the project folder to `C:\xampp\htdocs\event-management-system`. Alternatively, add an Apache `Alias` for this workspace folder and grant access to it.
3. Open `http://localhost/phpmyadmin`, import `backend/database/schema.sql`, then optionally import `backend/database/sample-data.sql` for local test accounts and events. Re-importing the sample file adds ten more published future events (12 sample events total) without duplicating existing sample slugs.
4. The default local database configuration is host `127.0.0.1`, database `event_management`, user `root`, and an empty password. For another setup, export `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` to the Apache/PHP process. `backend/.env.example` lists the variable names; PHP does not load `.env` files automatically.
5. Open `http://localhost/event-management-system/` (or `http://localhost/event-management-system/frontend/`). The API is served by `backend/index.php/api/...`; the frontend uses a relative API base.

PHP needs the `pdo_mysql`, `fileinfo`, and `mbstring` extensions enabled. The Apache process must be allowed to create/write `backend/uploads` for event images. Do not expose the sample accounts or the default XAMPP database credentials on a public server.

### Local Demo Accounts

The optional sample SQL creates:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@gather.local` | `password` |
| Organizer | `host@gather.local` | `password` |
| Attendee | `guest@gather.local` | `password` |

These are deliberately weak classroom credentials. Use only on a private local database and change/remove them before deployment. For a fresh administrator in a non-demo install, register an account and promote it from phpMyAdmin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-local-admin@example.test';
```

Organizer accounts are likewise created by registering an attendee and changing its role to `organizer` in the local database. Public registration cannot self-assign a privileged role.

## Implemented Flows

- Attendee registration/login/logout with PHP password hashing, session regeneration, CSRF token checks, and role-gated API operations.
- Published-event browsing, text search, category/city/date filters, event details, organizer schedules, and available-ticket display.
- Organizer event creation, optional image upload (JPEG/PNG/WebP, 5 MB maximum), venue-capacity validation, venue-time conflict checks, and pending admin review.
- Transactional booking inventory reservation, server-calculated totals, unique booking references, clearly labeled demo payment confirmation, booking history, and cancellation more than 24 hours before the event.
- Venue CRUD API with ownership checks, admin overview/reports, event approval/rejection, account suspension, category creation/removal, stored contact inquiries, and in-site notifications.
- Responsive public pages and role-specific attendee, organizer, and administrator dashboards.

The payment workflow is a local simulation: it does not contact a payment gateway and never charges money. The booking reference is the ticket identifier; it is not a scannable QR image. Automated email/SMS reminders, gateway refunds, and production-grade reporting are not configured.

## API

All endpoints return `{ "success": boolean, "message": string, "data": object }`. JSON mutation requests require the session CSRF token in `X-CSRF-Token`; `GET /auth/session` provides the current user and token. Browser requests use credentialed same-origin sessions.

| Method | Path | Access / purpose |
| --- | --- | --- |
| GET, POST | `/auth/session`, `/auth/register`, `/auth/login` | Session, attendee registration, login |
| POST | `/auth/logout` | Authenticated session; CSRF required |
| GET | `/events` | All matching published events for Explore; no homepage result limit |
| GET | `/events/featured` | The three nearest upcoming published events for the homepage only |
| GET | `/events/{id}`, `/categories` | Event details and category discovery |
| GET | `/events/manage` | Organizer's own events or all events for admin |
| POST, PUT, DELETE | `/events`, `/events/{id}` | Organizer-owned events; admin may manage all |
| POST | `/events/{id}/image` | Organizer-owned image upload |
| GET, POST, PUT, DELETE | `/venues`, `/venues/{id}` | Read venues; organizer-owned or admin mutations |
| POST, GET | `/bookings` | Attendee booking and history |
| GET, PUT | `/bookings/{id}`, `/bookings/{id}/cancel` | Attendee's own booking |
| POST, GET | `/payments` | Demo payment confirmation and own payment history |
| GET | `/payments/{id}` | Attendee's own payment/ticket details |
| GET, PUT | `/notifications`, `/notifications/{id}/read` | Signed-in user's notifications |
| POST | `/contact` | Store a validated public contact message |
| GET | `/admin/dashboard`, `/admin/users`, `/admin/events`, `/admin/reports`, `/admin/payments` | Admin only |
| GET | `/admin/messages` | Admin-only contact inbox |
| PUT | `/admin/events/{id}/status`, `/admin/users/{id}/status` | Admin only |
| POST, DELETE | `/admin/categories`, `/admin/categories/{id}` | Admin only |

Append endpoint paths to `backend/index.php/api`, for example `GET /backend/index.php/api/events`.

## Database

Import `backend/database/schema.sql` once. It creates the database, normalized InnoDB tables, indexes, constraints, and starter categories. It is intentionally non-destructive on re-import. `sample-data.sql` is optional and idempotent for its local accounts, venues, and events.

Core relationships include organizer-to-events, category/venue-to-events, attendee-to-bookings, booking-to-payment, event-to-schedule, and user-to-notifications. Ticket availability is updated under a row lock in a transaction to prevent overselling.

## Verification

1. Sign in with each local sample role and verify that other-role API/dashboard access redirects or returns an authorization error.
2. As an organizer, create an event for an unoccupied time and venue; verify a conflicting venue/time request is rejected.
3. As admin, approve the event; then search/filter it and inspect its details as a guest.
4. As an attendee, book tickets and confirm the demo payment. Confirm the inventory decreases and a unique booking reference appears in the account dashboard.
5. Cancel a confirmed booking more than 24 hours before the event and confirm inventory is restored; try again inside 24 hours and confirm it is rejected.
6. Exercise invalid login, duplicate registration, invalid ticket quantities, unauthorized dashboard/API calls, and an invalid image upload.

Editor diagnostics were checked during implementation. A live PHP/MySQL integration run still requires the project to be started in a configured XAMPP environment.