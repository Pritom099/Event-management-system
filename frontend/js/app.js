(() => {
    const root = document.body.dataset.root || './';
    const apiBase = document.querySelector('meta[name="api-base"]')?.content || '../backend/index.php/api';
    let csrf = '';
    let currentUser = null;

    const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const money = value => Number(value) === 0 ? 'Free' : `$${Number(value).toFixed(2)}`;
    const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const toast = (message, error = false) => {
        let region = document.querySelector('.toast-region');
        if (!region) { region = document.createElement('div'); region.className = 'toast-region'; region.setAttribute('aria-live', 'polite'); document.body.append(region); }
        const item = document.createElement('div'); item.className = `toast${error ? ' error' : ''}`; item.textContent = message; region.append(item);
        window.setTimeout(() => item.remove(), 3800);
    };

    async function api(path, options = {}) {
        const isFormData = options.body instanceof FormData;
        const headers = { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
        if (csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['X-CSRF-Token'] = csrf;
        const response = await fetch(`${apiBase}${path}`, { credentials: 'include', ...options, headers });
        const result = await response.json().catch(() => ({ success: false, message: 'Unexpected server response.' }));
        if (!response.ok || !result.success) throw new Error(result.message || 'Request failed.');
        return result.data;
    }

    const eventImage = event => {
        if (!event.image_path) return 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1400&q=92';
        if (!/^https?:\/\//i.test(event.image_path)) return `${root}../backend/${event.image_path}`;
        try {
            const imageUrl = new URL(event.image_path);
            if (imageUrl.hostname.endsWith('unsplash.com')) {
                imageUrl.searchParams.set('w', '1400');
                imageUrl.searchParams.set('q', '92');
            }
            return imageUrl.href;
        } catch { return event.image_path; }
    };
    function eventCard(event) {
        return `<article class="event-card"><img class="event-image" src="${escapeHtml(eventImage(event))}" alt="${escapeHtml(event.title)}" loading="lazy"><div class="event-content"><div class="event-meta">${escapeHtml(event.category || 'Gathering')}</div><h3 class="event-title">${escapeHtml(event.title)}</h3><div class="event-info"><span><i class="fa-regular fa-calendar"></i>${escapeHtml(dateLabel(event.event_date))} · ${escapeHtml(String(event.start_time || '').slice(0, 5))}</span><span><i class="fa-solid fa-location-dot"></i>${escapeHtml(event.venue || event.city || 'Location to be announced')}${event.city ? `, ${escapeHtml(event.city)}` : ''}</span><span><i class="fa-solid fa-ticket"></i>${Number(event.available_tickets)} seats left</span></div><div class="event-bottom"><div class="price">${money(event.ticket_price)}<small>per ticket</small></div><a class="btn btn-small" href="${root}event-details.html?id=${encodeURIComponent(event.id)}">View details <i class="fa-solid fa-arrow-right"></i></a></div></div></article>`;
    }

    function setShell() {
        const announcement = document.createElement('div'); announcement.className = 'announcement'; announcement.textContent = 'Find your people. Find your next event.';
        const header = document.createElement('header'); header.className = 'site-header';
        header.innerHTML = `<div class="wrap nav"><a class="brand" href="${root}index.html"><span class="brand-mark"><i class="fa-solid fa-sparkles"></i></span>gather<span style="color:var(--coral)">.</span></a><button class="nav-toggle" aria-label="Toggle navigation"><i class="fa-solid fa-bars"></i></button><nav class="nav-links"><a href="${root}events.html">Explore events</a><a href="${root}about.html">Our story</a><a href="${root}contact.html">Contact</a></nav><div class="nav-actions" id="nav-actions"><a class="btn btn-outline btn-small" href="${root}login.html">Sign in</a><a class="btn btn-small" href="${root}register.html">Join Gather</a></div></div>`;
        const footer = document.createElement('footer'); footer.className = 'site-footer';
        footer.innerHTML = `<div class="wrap"><div class="footer-top"><div><a class="brand" href="${root}index.html"><span class="brand-mark"><i class="fa-solid fa-sparkles"></i></span>gather.</a><p class="footer-intro">Good things happen when people get together. Find a room, a reason, and your next favorite memory.</p></div><div class="footer-column"><h3>Discover</h3><div class="footer-links"><a href="${root}events.html">All events</a><a href="${root}events.html?category=music">Music & culture</a><a href="${root}events.html?category=technology">Ideas & tech</a></div></div><div class="footer-column"><h3>Gather</h3><div class="footer-links"><a href="${root}about.html">About us</a><a href="${root}contact.html">Get in touch</a><a href="${root}register.html">Host an event</a></div></div><div class="footer-column"><h3>Your account</h3><div class="footer-links"><a href="${root}login.html">Sign in</a><a href="${root}register.html">Create an account</a><a href="${root}booking.html">My tickets</a></div></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Gather. Made for being there.</span><span>Demo payments only · No real charges</span></div></div>`;
        document.body.prepend(header); document.body.prepend(announcement); document.body.append(footer);
        header.querySelector('.nav-toggle').addEventListener('click', () => header.querySelector('.nav-links').classList.toggle('open'));
    }

    async function session() {
        try { const data = await api('/auth/session'); csrf = data.csrf || ''; currentUser = data.user; }
        catch { currentUser = null; }
        const actions = document.querySelector('#nav-actions');
        if (actions && currentUser) actions.innerHTML = `<a class="btn btn-outline btn-small" href="${root}dashboard/${currentUser.role === 'admin' ? 'admin' : currentUser.role === 'organizer' ? 'organizer' : 'user'}/index.html">Dashboard</a><button class="btn btn-small" id="logout-button">Sign out</button>`;
        document.querySelector('#logout-button')?.addEventListener('click', async () => { try { await api('/auth/logout', { method: 'POST' }); location.href = `${root}index.html`; } catch (error) { toast(error.message, true); } });
        const expectedRole = document.body.dataset.role;
        if (expectedRole && currentUser?.role !== expectedRole) location.replace(`${root}login.html`);
    }

    async function loadEvents(target, params = new URLSearchParams(), endpoint = '/events') {
        const container = document.querySelector(target);
        if (!container) return;
        container.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Finding your next event…</div>';
        try {
            const data = await api(`${endpoint}${params.size ? `?${params}` : ''}`);
            const featuredCount = container.id === 'featured-events' ? document.querySelector('#featured-count') : null;
            if (featuredCount) featuredCount.textContent = data.events.length ? `Showing ${data.events.length} upcoming events` : 'New events will appear here as hosts publish them.';
            container.innerHTML = data.events.length ? data.events.map(eventCard).join('') : '<div class="empty-state"><i class="fa-regular fa-calendar"></i><h3>No events match just yet</h3><p>Try a different search, or check back soon for something good.</p></div>';
        } catch (error) { container.innerHTML = `<div class="error-state">${escapeHtml(error.message)}<br>Check that the PHP API and database are running.</div>`; }
    }

    function initHome() {
        const featured = document.querySelector('#featured-events');
        if (featured) loadEvents('#featured-events', new URLSearchParams(), '/events/featured');
        const form = document.querySelector('#home-search');
        form?.addEventListener('submit', event => { event.preventDefault(); const params = new URLSearchParams(new FormData(form)); location.href = `${root}events.html?${params}`; });
    }

    function initEvents() {
        const form = document.querySelector('#event-filters');
        const params = new URLSearchParams(location.search);
        const categorySelect = form?.elements.namedItem('category');
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">All categories</option>';
            api('/categories').then(data => {
                categorySelect.innerHTML = '<option value="">All categories</option>' + data.categories.map(item => `<option value="${escapeHtml(item.slug)}">${escapeHtml(item.name)}</option>`).join('');
                categorySelect.value = params.get('category') || '';
            }).catch(() => { });
        }
        for (const key of ['q', 'category', 'city', 'date']) {
            const field = form?.elements.namedItem(key);
            if (field && key !== 'category') field.value = params.get(key) || '';
            if (field && key === 'category' && !categorySelect) field.value = params.get(key) || '';
        }
        loadEvents('#event-results', params);
        form?.addEventListener('submit', event => { event.preventDefault(); const next = new URLSearchParams(new FormData(form)); for (const [key, value] of [...next]) if (!value) next.delete(key); history.replaceState(null, '', `${location.pathname}?${next}`); loadEvents('#event-results', next); });
    }

    async function initDetails() {
        const target = document.querySelector('#event-detail'); if (!target) return;
        const id = new URLSearchParams(location.search).get('id');
        if (!id) { target.innerHTML = '<div class="empty-state">Choose an event from the events page.</div>'; return; }
        try {
            const { event } = await api(`/events/${encodeURIComponent(id)}`);
            document.title = `${event.title} · Gather`;
            target.innerHTML = `<div><img class="detail-banner" src="${escapeHtml(eventImage(event))}" alt="${escapeHtml(event.title)}"><p class="section-kicker" style="margin-top:27px">${escapeHtml(event.category)}</p><h1 class="section-title">${escapeHtml(event.title)}</h1><p class="detail-description">${escapeHtml(event.description)}</p><h2 class="section-title" style="font-size:1.8rem;margin-top:35px">The host</h2><p class="detail-description">Hosted by ${escapeHtml(event.organizer)} at ${escapeHtml(event.venue)}.</p>${event.schedule?.length ? `<h2 class="section-title" style="font-size:1.8rem;margin-top:35px">Schedule</h2>${event.schedule.map(item => `<p class="panel-line"><strong>${escapeHtml(item.title)}</strong> · ${escapeHtml(item.starts_at)} ${escapeHtml(item.details || '')}</p>`).join('')}` : ''}</div><aside class="booking-panel"><p class="section-kicker">Save your seat</p><p class="panel-price">${money(event.ticket_price)} <small style="font:400 .8rem var(--sans);color:var(--muted)">/ ticket</small></p><div class="panel-line"><i class="fa-regular fa-calendar"></i> ${escapeHtml(dateLabel(event.event_date))} · ${escapeHtml(String(event.start_time).slice(0, 5))}</div><div class="panel-line"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(event.venue)}, ${escapeHtml(event.city)}</div><div class="panel-line"><i class="fa-solid fa-ticket"></i> ${Number(event.available_tickets)} tickets available</div><a class="btn" style="width:100%;margin-top:17px" href="${root}booking.html?event=${encodeURIComponent(event.id)}">Book tickets</a></aside>`;
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    async function initAuth() {
        const form = document.querySelector('#auth-form'); if (!form) return;
        form.addEventListener('submit', async event => {
            event.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Please wait…';
            try {
                const values = Object.fromEntries(new FormData(form));
                const route = form.dataset.mode === 'register' ? '/auth/register' : '/auth/login';
                const data = await api(route, { method: 'POST', body: JSON.stringify(values) }); csrf = data.csrf; currentUser = data.user;
                toast(form.dataset.mode === 'register' ? 'Your account is ready.' : 'Welcome back.');
                location.href = `${root}dashboard/${currentUser.role === 'admin' ? 'admin' : currentUser.role === 'organizer' ? 'organizer' : 'user'}/index.html`;
            } catch (error) { toast(error.message, true); button.disabled = false; button.textContent = form.dataset.mode === 'register' ? 'Create account' : 'Sign in'; }
        });
    }

    async function initBooking() {
        const form = document.querySelector('#booking-form'); if (!form) return;
        const eventId = new URLSearchParams(location.search).get('event');
        if (!eventId) { form.innerHTML = '<p>Choose an event before booking.</p><a class="btn" href="../events.html">Explore events</a>'; return; }
        try {
            const { event } = await api(`/events/${encodeURIComponent(eventId)}`);
            document.querySelector('#booking-summary').innerHTML = `<img class="event-image" src="${escapeHtml(eventImage(event))}" alt=""><div class="event-content"><div class="event-meta">${escapeHtml(event.category)}</div><h2 class="event-title">${escapeHtml(event.title)}</h2><p>${escapeHtml(dateLabel(event.event_date))} · ${escapeHtml(event.venue)}, ${escapeHtml(event.city)}</p><p>Ticket price: <strong>${money(event.ticket_price)}</strong></p><p>${Number(event.available_tickets)} tickets remaining</p></div>`;
            form.elements.event_id.value = event.id;
            const qty = form.elements.quantity;
            qty.max = Math.min(10, Number(event.available_tickets));
            const total = document.querySelector('#booking-total');
            const update = () => { total.textContent = money(Number(event.ticket_price) * Number(qty.value || 1)); };
            qty.addEventListener('input', update); update();
            form.addEventListener('submit', async submitEvent => {
                submitEvent.preventDefault(); if (!currentUser) { location.href = `${root}login.html`; return; }
                try {
                    const booking = await api('/bookings', { method: 'POST', body: JSON.stringify({ event_id: event.id, quantity: qty.value }) });
                    const payment = await api('/payments', { method: 'POST', body: JSON.stringify({ booking_id: booking.id }) });
                    document.querySelector('#booking-result').innerHTML = `<div class="notice" style="background:#e5eddc;color:#315b43"><strong>Booking confirmed.</strong><br>Reference ${escapeHtml(payment.booking_reference)} · ${money(payment.amount)}<br><small>Demo payment only. No real money was charged.</small></div><a class="btn" href="${root}dashboard/user/index.html">View your tickets</a>`;
                    form.hidden = true;
                } catch (error) { toast(error.message, true); }
            });
        } catch (error) { document.querySelector('#booking-summary').textContent = error.message; }
    }

    async function initUserDashboard() {
        const target = document.querySelector('#user-bookings'); if (!target) return;
        try {
            const data = await api('/bookings');
            target.innerHTML = data.bookings.length ? `<div class="table-wrap"><table><thead><tr><th>Event</th><th>Date</th><th>Tickets</th><th>Total</th><th>Status</th><th>Ticket reference</th><th></th></tr></thead><tbody>${data.bookings.map(item => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(dateLabel(item.event_date))}</td><td>${Number(item.quantity)}</td><td>${money(item.total_amount)}</td><td><span class="status">${escapeHtml(item.status.replace('_', ' '))}</span></td><td>${escapeHtml(item.reference)}</td><td>${item.status === 'confirmed' ? `<button class="btn btn-small btn-outline cancel-booking" data-id="${item.id}">Cancel</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No tickets yet. Your next good story is out there.</div>';
            if (!target.dataset.bound) {
                target.dataset.bound = 'true';
                target.addEventListener('click', async event => {
                    const button = event.target.closest('.cancel-booking'); if (!button || !confirm('Cancel this booking?')) return;
                    try { await api(`/bookings/${button.dataset.id}/cancel`, { method: 'PUT', body: '{}' }); toast('Booking cancelled.'); initUserDashboard(); }
                    catch (error) { toast(error.message, true); }
                });
            }
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    async function initOrganizerDashboard() {
        const form = document.querySelector('#create-event-form'); if (!form) return;
        try {
            const [categories, venues] = await Promise.all([api('/categories'), api('/venues')]);
            form.elements.category_id.innerHTML = categories.categories.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
            form.elements.venue_id.innerHTML = venues.venues.map(item => `<option value="${item.id}">${escapeHtml(item.name)} · ${escapeHtml(item.city)}</option>`).join('');
        } catch (error) { toast(error.message, true); }
        form.addEventListener('submit', async event => {
            event.preventDefault();
            try {
                const values = Object.fromEntries(new FormData(form));
                const image = form.elements.image?.files[0];
                const created = await api('/events', { method: 'POST', body: JSON.stringify(values) });
                if (image) { const imageData = new FormData(); imageData.append('image', image); await api(`/events/${created.id}/image`, { method: 'POST', body: imageData }); }
                form.reset(); toast('Event submitted for review.'); loadOrganizerEvents();
            }
            catch (error) { toast(error.message, true); }
        });
        loadOrganizerEvents();
        const venueForm = document.querySelector('#create-venue-form');
        venueForm?.addEventListener('submit', async event => {
            event.preventDefault();
            try {
                await api('/venues', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(venueForm))) });
                venueForm.reset(); toast('Venue saved.');
                const venues = await api('/venues');
                form.elements.venue_id.innerHTML = venues.venues.map(item => `<option value="${item.id}">${escapeHtml(item.name)} · ${escapeHtml(item.city)}</option>`).join('');
            } catch (error) { toast(error.message, true); }
        });
    }

    async function loadOrganizerEvents() {
        const target = document.querySelector('#organizer-events'); if (!target) return;
        try {
            const data = await api('/events/manage');
            target.innerHTML = data.events.length ? `<div class="table-wrap"><table><thead><tr><th>Event</th><th>Date</th><th>Status</th><th>Sold</th><th>Available</th><th>Revenue</th></tr></thead><tbody>${data.events.map(item => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(dateLabel(item.event_date))}</td><td><span class="status">${escapeHtml(item.status)}</span></td><td>${Number(item.tickets_sold)}</td><td>${Number(item.available_tickets)} / ${Number(item.total_tickets)}</td><td>${money(item.revenue)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">Your submitted events will appear here.</div>';
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    async function initAdminDashboard() {
        const stats = document.querySelector('#admin-stats'); if (!stats) return;
        try {
            const data = await api('/admin/dashboard');
            stats.innerHTML = Object.entries({ 'Attendees': data.stats.users, 'Organizers': data.stats.organizers, 'Published events': data.stats.events, 'Confirmed bookings': data.stats.bookings, 'Demo revenue': money(data.stats.revenue), 'Needs review': data.stats.pending_events }).map(([label, value]) => `<div class="dashboard-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
            document.querySelector('#admin-bookings').innerHTML = data.recent_bookings.map(row => `<tr><td>${escapeHtml(row.reference)}</td><td>${escapeHtml(row.attendee)}</td><td>${escapeHtml(row.title)}</td><td>${money(row.total_amount)}</td><td>${escapeHtml(row.status)}</td></tr>`).join('');
            loadAdminEvents(); loadAdminUsers(); loadAdminReports(); loadAdminMessages(); initAdminCategories();
        } catch (error) { stats.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    async function loadAdminEvents() {
        const target = document.querySelector('#admin-events'); if (!target) return;
        try {
            const data = await api('/admin/events');
            target.innerHTML = data.events.length ? `<div class="table-wrap"><table><thead><tr><th>Event</th><th>Organizer</th><th>Date</th><th>Status</th><th>Review</th></tr></thead><tbody>${data.events.map(item => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.organizer)}</td><td>${escapeHtml(dateLabel(item.event_date))}</td><td>${escapeHtml(item.status)}</td><td>${item.status === 'pending' ? `<button class="btn btn-small review-event" data-id="${item.id}" data-status="published">Approve</button> <button class="btn btn-small btn-outline review-event" data-id="${item.id}" data-status="rejected">Reject</button>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No submitted events yet.</div>';
            if (!target.dataset.bound) {
                target.dataset.bound = 'true';
                target.addEventListener('click', async event => {
                    const button = event.target.closest('.review-event'); if (!button) return;
                    try { await api(`/admin/events/${button.dataset.id}/status`, { method: 'PUT', body: JSON.stringify({ status: button.dataset.status }) }); toast('Event review saved.'); loadAdminEvents(); }
                    catch (error) { toast(error.message, true); }
                });
            }
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    async function loadAdminUsers() {
        const target = document.querySelector('#admin-users'); if (!target) return;
        try {
            const data = await api('/admin/users');
            target.innerHTML = data.users.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead><tbody>${data.users.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.role)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(dateLabel(item.created_at.slice(0, 10)))}</td><td>${item.role !== 'admin' ? `<button class="btn btn-small user-status" data-id="${item.id}" data-status="${item.status === 'active' ? 'suspended' : 'active'}">${item.status === 'active' ? 'Suspend' : 'Restore'}</button>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No accounts yet.</div>';
            if (!target.dataset.bound) {
                target.dataset.bound = 'true';
                target.addEventListener('click', async event => {
                    const button = event.target.closest('.user-status'); if (!button) return;
                    try { await api(`/admin/users/${button.dataset.id}/status`, { method: 'PUT', body: JSON.stringify({ status: button.dataset.status }) }); toast('Account status updated.'); loadAdminUsers(); }
                    catch (error) { toast(error.message, true); }
                });
            }
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    async function loadAdminReports() {
        const target = document.querySelector('#admin-reports'); if (!target) return;
        try {
            const data = await api('/admin/reports');
            const bars = (rows, key, formatter, variant = '') => {
                const max = Math.max(1, ...rows.map(row => Number(row[key])));
                return rows.length ? `<div class="report-bars">${rows.map(row => `<div class="report-row"><span>${escapeHtml(row.month)}</span><div class="report-track"><div class="report-fill ${variant}" style="width:${Math.max(2, Number(row[key]) / max * 100)}%"></div></div><strong>${formatter(row[key])}</strong></div>`).join('')}</div>` : '<p class="detail-description">No report data yet.</p>';
            };
            target.innerHTML = `<h3>Monthly bookings</h3>${bars(data.monthly_bookings, 'bookings', value => Number(value))}<h3 style="margin-top:24px">Monthly demo revenue</h3>${bars(data.monthly_revenue, 'revenue', value => money(value), 'revenue')}<h3 style="margin-top:24px">Most-booked events</h3>${data.popular_events.length ? `<div class="table-wrap"><table><thead><tr><th>Event</th><th>Confirmed tickets</th></tr></thead><tbody>${data.popular_events.map(row => `<tr><td>${escapeHtml(row.title)}</td><td>${Number(row.tickets)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="detail-description">No event bookings yet.</p>'}`;
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    async function loadAdminMessages() {
        const target = document.querySelector('#admin-messages'); if (!target) return;
        try {
            const data = await api('/admin/messages');
            target.innerHTML = data.messages.length ? `<div class="table-wrap"><table><thead><tr><th>Received</th><th>From</th><th>Email</th><th>Subject</th><th>Message</th></tr></thead><tbody>${data.messages.map(item => `<tr><td>${escapeHtml(dateLabel(item.created_at.slice(0, 10)))}</td><td>${escapeHtml(item.name)}</td><td><a href="mailto:${encodeURIComponent(item.email)}">${escapeHtml(item.email)}</a></td><td>${escapeHtml(item.subject)}</td><td>${escapeHtml(item.message)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="detail-description">No messages have been received.</p>';
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    async function initAdminCategories() {
        const target = document.querySelector('#admin-categories'); if (!target) return;
        const form = document.querySelector('#create-category-form');
        if (form && !form.dataset.bound) {
            form.dataset.bound = 'true';
            form.addEventListener('submit', async event => {
                event.preventDefault();
                try { await api('/admin/categories', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); toast('Category added.'); initAdminCategories(); }
                catch (error) { toast(error.message, true); }
            });
        }
        try {
            const data = await api('/categories');
            target.innerHTML = data.categories.map(item => `<div class="panel-line"><strong>${escapeHtml(item.name)}</strong> <span class="detail-description">${escapeHtml(item.slug)}</span> <button class="btn btn-small btn-outline delete-category" data-id="${item.id}">Delete</button></div>`).join('');
            if (!target.dataset.bound) {
                target.dataset.bound = 'true';
                target.addEventListener('click', async event => {
                    const button = event.target.closest('.delete-category'); if (!button || !confirm('Delete this category?')) return;
                    try { await api(`/admin/categories/${button.dataset.id}`, { method: 'DELETE' }); toast('Category deleted.'); initAdminCategories(); }
                    catch (error) { toast(error.message, true); }
                });
            }
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    async function initNotifications() {
        const target = document.querySelector('#notifications'); if (!target) return;
        try {
            const data = await api('/notifications');
            target.innerHTML = data.notifications.length ? data.notifications.map(item => `<div class="panel-line"><strong>${escapeHtml(item.title)}</strong> · ${escapeHtml(item.body)}${item.read_at ? '' : ` <button class="btn btn-small mark-read" data-id="${item.id}">Mark read</button>`}</div>`).join('') : '<p class="detail-description">You’re all caught up.</p>';
            if (!target.dataset.bound) {
                target.dataset.bound = 'true';
                target.addEventListener('click', async event => {
                    const button = event.target.closest('.mark-read'); if (!button) return;
                    try { await api(`/notifications/${button.dataset.id}/read`, { method: 'PUT', body: '{}' }); initNotifications(); }
                    catch (error) { toast(error.message, true); }
                });
            }

        } catch (error) { target.textContent = error.message; }
    }

    function initContact() {
        const form = document.querySelector('#contact-form'); if (!form) return;
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const button = form.querySelector('button[type="submit"]'); button.disabled = true;
            try {
                const data = await api('/contact', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
                document.querySelector('#contact-result').innerHTML = `<div class="notice" style="background:#e5eddc;color:#315b43">${escapeHtml(data.message)}</div>`;
                form.reset();
            } catch (error) { toast(error.message, true); }
            finally { button.disabled = false; }
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        setShell();
        await session();
        initHome(); initEvents(); initDetails(); initAuth(); initBooking(); initUserDashboard(); initOrganizerDashboard(); initAdminDashboard(); initNotifications(); initContact();
    });
})();