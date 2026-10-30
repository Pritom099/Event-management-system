# Gather

<p align="center">
	<strong>Event Management System</strong><br>
	Discover local events. Save your seat. Host your next gathering.
</p>

<p align="center">
	<img alt="PHP 8+" src="https://img.shields.io/badge/PHP-8%2B-777BB4?logo=php&logoColor=white">
	<img alt="MySQL" src="https://img.shields.io/badge/MySQL-8%2B-4479A1?logo=mysql&logoColor=white">
	<img alt="Vanilla JavaScript" src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=222">
	<img alt="XAMPP" src="https://img.shields.io/badge/Local%20server-XAMPP-FB7A24?logo=apachefriends&logoColor=white">
</p>

Gather is an academic event discovery and management application. Its frontend uses HTML, CSS, and vanilla JavaScript; its backend is a Core PHP JSON API backed by MySQL. The frontend and backend are kept separate, with no application framework.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Project Layout](#project-layout)
- [Quick Start](#quick-start)
- [Demo Accounts](#demo-accounts)
- [API Reference](#api-reference)
- [Database](#database)
- [Verification](#verification)
- [Known Limitations](#known-limitations)

## Features

| Attendees | Organizers | Administrators |
| --- | --- | --- |
| Browse and filter published events | Submit and manage event listings | Review and approve submitted events |
| View event details and schedules | Upload event images | View platform totals and reports |
| Book tickets and view references | Create venues and view ticket sales | Manage users and event categories |
| Demo checkout and booking history | Check venue capacity and schedule conflicts | Review bookings, payments, and contact messages |
| Cancel eligible bookings | Receive in-site notifications |  |

All signed-in roles can open the shared dashboard profile page to view their name, email address, and account role.

The homepage shows the **three nearest upcoming events**. Explore Events displays the complete matching event list with search, category, city, and date filters.

## Technology

- **Frontend:** HTML5, CSS3, vanilla JavaScript, Fetch API, Font Awesome, Google Fonts
- **Backend:** PHP 8.0+, PDO, PHP sessions
- **Database:** MySQL 8.0+ or compatible MariaDB with InnoDB
- **Local environment:** XAMPP, Apache, MySQL

## Project Layout

```text
frontend/
	index.html                Homepage
	events.html               Search and filter all published events
	event-details.html        Event details and booking entry point
	login.html                Sign in
	register.html             Attendee registration
	booking.html              Ticket booking and demo checkout
	dashboard/                Shared profile plus attendee, organizer, and admin dashboards
	css/                      Shared responsive styles
	js/                       Fetch API and page behavior
backend/
	config/                   PDO connection
	controllers/              Authentication, event, booking, and admin logic
	database/                 Schema and optional sample data
	middleware/               JSON responses, sessions, CSRF, and authorization
	routes/                   API dispatch
	uploads/                  Organizer event images (created when needed)
	index.php                 API entry point
index.html                  Redirects to the frontend homepage
README.md
```

## Quick Start

### 1. Start XAMPP

Start **Apache** and **MySQL** in the XAMPP Control Panel.

### 2. Serve the project

Apache must be able to access the project beneath its document root, usually `C:\xampp\htdocs`. You can copy the project folder there as `event-management-system`. To serve the workspace directly from another drive, open PowerShell and create a junction (adjust the target path if needed):

```powershell
New-Item -ItemType Junction `
	-Path "C:\xampp\htdocs\event-management-system" `
	-Target "E:\Event-Management-System\event-management-system"
```

If the junction already exists, do not create it again. The current local setup uses this junction, so workspace edits are served directly by Apache.

### 3. Create and seed the database

1. Open [phpMyAdmin](http://localhost/phpmyadmin).
2. Select **Import** and import `backend/database/schema.sql`.
3. Optionally import `backend/database/sample-data.sql` to add local demo accounts, venues, and 12 upcoming events. Re-importing adds no duplicate events and resets the three demo accounts to the documented local password.

### 4. Check the database connection

The defaults in `backend/config/database.php` match a standard local XAMPP install:

| Setting | Default |
| --- | --- |
| Host | `127.0.0.1` |
| Database | `event_management` |
| User | `root` |
| Password | *(empty)* |

If your MySQL credentials differ, set `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in the Apache/PHP environment. `backend/.env.example` lists the variables; PHP does not load `.env` files automatically.

Ensure PHP has `pdo_mysql`, `fileinfo`, and `mbstring` enabled. Apache needs write access to `backend/uploads` for event image uploads.

### 5. Open Gather

Visit **[http://localhost/event-management-system/](http://localhost/event-management-system/)**. The root page redirects to the frontend. The frontend calls the API at `backend/index.php/api/...`; opening the HTML files as `file://` will not provide working PHP/API features.

## Demo Accounts

Import the optional sample data, then sign in with one of these local-only accounts:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@gather.local` | `password` |
| Organizer | `host@gather.local` | `password` |
| Attendee | `guest@gather.local` | `password` |

These classroom credentials are intentionally weak. Use them only on a private development database; change or remove them before deployment. Public registration creates attendee accounts only. To promote a local account for admin or organizer testing, update its role in phpMyAdmin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-local-admin@example.test';
UPDATE users SET role = 'organizer' WHERE email = 'your-local-organizer@example.test';
```

## API Reference

All endpoints return a consistent JSON envelope:

```json
{
	"success": true,
	"message": "Operation successful",
	"data": {}
}
```

`GET /auth/session` returns the signed-in user and a CSRF token. Send the token in `X-CSRF-Token` for state-changing requests. Browser requests use credentialed PHP sessions.

| Method | Endpoint | Purpose / access |
| --- | --- | --- |
| GET, POST | `/auth/session`, `/auth/register`, `/auth/login` | Session, attendee registration, and sign-in |
| POST | `/auth/logout` | Sign out; CSRF required |
| GET | `/events/featured` | Three nearest upcoming published events for the homepage |
| GET | `/events` | All matching published events for Explore; supports `q`, `category`, `city`, and `date` |
| GET | `/events/{id}`, `/categories` | Event details and category list |
| GET | `/events/manage` | Organizer's own events or all events for admin |
| POST, PUT, DELETE | `/events`, `/events/{id}` | Organizer-owned event operations; admin may manage all |
| POST | `/events/{id}/image` | Organizer-owned JPEG, PNG, or WebP image upload |
| GET, POST, PUT, DELETE | `/venues`, `/venues/{id}` | Venue listing and authorized venue operations |
| POST, GET | `/bookings` | Create a booking and view the signed-in attendee's history |
| GET, PUT | `/bookings/{id}`, `/bookings/{id}/cancel` | View or cancel the attendee's own booking |
| POST, GET | `/payments` | Demo payment and signed-in attendee's payment history |
| GET | `/payments/{id}` | Signed-in attendee's payment/ticket details |
| GET, PUT | `/notifications`, `/notifications/{id}/read` | View and mark the user's notifications |
| POST | `/contact` | Submit a validated contact message |
| GET | `/admin/dashboard`, `/admin/users`, `/admin/events`, `/admin/reports`, `/admin/payments`, `/admin/messages` | Admin-only dashboard and reports |
| PUT | `/admin/events/{id}/status`, `/admin/users/{id}/status` | Admin event review and account management |
| POST, DELETE | `/admin/categories`, `/admin/categories/{id}` | Admin category management |

Example local endpoint: `http://localhost/event-management-system/backend/index.php/api/events`.

## Database

Import `backend/database/schema.sql` to create the database, starter categories, and normalized InnoDB tables. The schema includes users, events, event schedules, bookings, payments, venues, categories, notifications, and contact messages, with foreign keys, indexes, and constraints. The schema is non-destructive on re-import.

`backend/database/sample-data.sql` is optional and intended for local development. Core relationships connect organizers to events, venues and categories to events, attendees to bookings, bookings to payments, events to schedules, and users to notifications. Booking inventory is reserved in a transaction under a row lock to prevent overselling.

## Verification

Use the demo accounts to check these flows in the browser:

1. Confirm the homepage shows three events and **Explore All Events** opens the full Explore list.
2. Search `music`; verify all matching Music-category events appear. Try category, city, and date filters as well.
3. As an organizer, create an event and venue; verify the event waits for admin approval and conflicting venue times are rejected.
4. As admin, approve the event and check the dashboard totals, user list, and reports.
5. As an attendee, book tickets and complete demo checkout. Verify the booking reference and inventory change.
6. Cancel a confirmed booking more than 24 hours before the event; verify inventory is restored. Check that a late cancellation is rejected.
7. Test duplicate registration, invalid credentials, invalid quantities, unauthorized role access, contact submission, and invalid image uploads.

## Known Limitations

- Checkout is a **demo payment only**; no gateway is configured and no money is charged.
- Tickets use a unique booking reference, not a generated/scannable QR code.
- No background service is configured for automated email/SMS reminders.
- Payment refunds and production-grade analytics are not integrated.
- The sample credentials and default XAMPP database configuration are not suitable for public deployment.

Email: admin@gather.local
Password: password
