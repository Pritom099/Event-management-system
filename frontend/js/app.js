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
    function eventCard(event, wishlistIds = new Set()) {
        const saved = wishlistIds.has(Number(event.id));
        return `<article class="event-card"><div class="event-image-wrap"><img class="event-image" src="${escapeHtml(eventImage(event))}" alt="${escapeHtml(event.title)}" loading="lazy"><button class="wishlist-toggle${saved ? ' is-saved' : ''}" type="button" data-event-id="${Number(event.id)}" aria-label="${saved ? 'Remove from' : 'Add to'} wishlist: ${escapeHtml(event.title)}" aria-pressed="${saved}"><i class="${saved ? 'fa-solid' : 'fa-regular'} fa-heart"></i></button></div><div class="event-content"><div class="event-meta">${escapeHtml(event.category || 'Gathering')}</div><div class="event-rating">${Number(event.review_count) ? `${starDisplay(event.average_rating)} <span>${Number(event.average_rating).toFixed(1)} · ${Number(event.review_count)} review${Number(event.review_count) === 1 ? '' : 's'}</span>` : '<span class="event-rating-empty">No reviews yet</span>'}</div><h3 class="event-title">${escapeHtml(event.title)}</h3><div class="event-info"><span><i class="fa-regular fa-calendar"></i>${escapeHtml(dateLabel(event.event_date))} · ${escapeHtml(String(event.start_time || '').slice(0, 5))}</span><span><i class="fa-solid fa-location-dot"></i>${escapeHtml(event.venue || event.city || 'Location to be announced')}${event.city ? `, ${escapeHtml(event.city)}` : ''}</span><span><i class="fa-solid fa-ticket"></i>${Number(event.available_tickets)} seats left</span></div><div class="event-bottom"><div class="price">${money(event.ticket_price)}<small>per ticket</small></div><a class="btn btn-small" href="${root}event-details.html?id=${encodeURIComponent(event.id)}">View details <i class="fa-solid fa-arrow-right"></i></a></div></div></article>`;
    }

    async function wishlistIds() {
        if (!currentUser) return new Set();
        try {
            const data = await api('/wishlist');
            return new Set(data.events.map(event => Number(event.id)));
        } catch { return new Set(); }
    }

    function bindWishlist(container) {
        if (container.dataset.wishlistBound) return;
        container.dataset.wishlistBound = 'true';
        container.addEventListener('click', async event => {
            const button = event.target.closest('.wishlist-toggle');
            if (!button) return;
            if (!currentUser) {
                toast('Sign in to save events.');
                window.setTimeout(() => { location.href = `${root}login.html`; }, 500);
                return;
            }
            const eventId = Number(button.dataset.eventId);
            const saved = button.getAttribute('aria-pressed') === 'true';
            button.disabled = true;
            try {
                if (saved) await api(`/wishlist/${eventId}`, { method: 'DELETE' });
                else await api('/wishlist', { method: 'POST', body: JSON.stringify({ event_id: eventId }) });
                setWishlistButton(button, !saved);
                toast(saved ? 'Removed from wishlist.' : 'Added to wishlist.');
                container.dispatchEvent(new CustomEvent('wishlist:changed', { bubbles: true, detail: { eventId, saved: !saved } }));
            } catch (error) {
                toast(error.message, true);
            } finally { button.disabled = false; }
        });
    }

    function setWishlistButton(button, saved) {
        button.classList.toggle('is-saved', saved);
        button.setAttribute('aria-pressed', String(saved));
        button.setAttribute('aria-label', `${saved ? 'Remove from' : 'Add to'} wishlist`);
        button.innerHTML = `<i class="${saved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>`;
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
        if (actions && currentUser) actions.innerHTML = `<a class="btn btn-outline btn-small" href="${root}dashboard/${currentUser.role === 'admin' ? 'admin' : currentUser.role === 'organizer' ? 'organizer' : 'user'}/index.html">Dashboard</a><a class="btn btn-outline btn-small" href="${root}dashboard/profile.html">Profile</a><button class="btn btn-small" id="logout-button">Sign out</button>`;
        document.querySelector('#logout-button')?.addEventListener('click', async () => { try { await api('/auth/logout', { method: 'POST' }); location.href = `${root}index.html`; } catch (error) { toast(error.message, true); } });
        const expectedRole = document.body.dataset.role;
        if (expectedRole && currentUser?.role !== expectedRole) location.replace(`${root}login.html`);
        if (document.body.dataset.requiresAuth === 'true' && !currentUser) location.replace(`${root}login.html`);
    }

    function initProfile() {
        const profile = document.querySelector('#profile-details');
        if (!profile || !currentUser) return;
        const roleNames = { attendee: 'Attendee', organizer: 'Event organizer', admin: 'Administrator' };
        document.querySelector('#profile-name').textContent = currentUser.name;
        document.querySelector('#profile-email').textContent = currentUser.email;
        document.querySelector('#profile-role').textContent = roleNames[currentUser.role] || currentUser.role;
        document.querySelector('#profile-initials').textContent = currentUser.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
        const dashboardLink = document.querySelector('#profile-dashboard-link');
        if (dashboardLink) dashboardLink.href = `${root}dashboard/${currentUser.role === 'admin' ? 'admin' : currentUser.role === 'organizer' ? 'organizer' : 'user'}/index.html`;
    }

    async function loadEvents(target, params = new URLSearchParams(), endpoint = '/events') {
        const container = document.querySelector(target);
        if (!container) return;
        container.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Finding your next event…</div>';
        try {
            const data = await api(`${endpoint}${params.size ? `?${params}` : ''}`);
            const savedEvents = await wishlistIds();
            const featuredCount = container.id === 'featured-events' ? document.querySelector('#featured-count') : null;
            if (featuredCount) featuredCount.textContent = data.events.length ? `Showing ${data.events.length} upcoming events` : 'New events will appear here as hosts publish them.';
            container.innerHTML = data.events.length ? data.events.map(event => eventCard(event, savedEvents)).join('') : '<div class="empty-state"><i class="fa-regular fa-calendar"></i><h3>No events match just yet</h3><p>Try a different search, or check back soon for something good.</p></div>';
            bindWishlist(container);
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
            const savedEvents = await wishlistIds();
            const isSaved = savedEvents.has(Number(event.id));
            document.title = `${event.title} · Gather`;
            target.innerHTML = `<div><img class="detail-banner" src="${escapeHtml(eventImage(event))}" alt="${escapeHtml(event.title)}"><div class="detail-title-row"><div><p class="section-kicker" style="margin-top:27px">${escapeHtml(event.category)}</p><h1 class="section-title">${escapeHtml(event.title)}</h1></div><button class="wishlist-toggle detail-wishlist${isSaved ? ' is-saved' : ''}" type="button" data-event-id="${Number(event.id)}" aria-label="${isSaved ? 'Remove from' : 'Add to'} wishlist: ${escapeHtml(event.title)}" aria-pressed="${isSaved}"><i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i></button></div><p class="detail-description">${escapeHtml(event.description)}</p><h2 class="section-title" style="font-size:1.8rem;margin-top:35px">The host</h2><p class="detail-description">Hosted by ${escapeHtml(event.organizer)} at ${escapeHtml(event.venue)}.</p>${event.schedule?.length ? `<h2 class="section-title" style="font-size:1.8rem;margin-top:35px">Schedule</h2>${event.schedule.map(item => `<p class="panel-line"><strong>${escapeHtml(item.title)}</strong> · ${escapeHtml(item.starts_at)} ${escapeHtml(item.details || '')}</p>`).join('')}` : ''}</div><aside class="booking-panel"><p class="section-kicker">Save your seat</p><p class="panel-price">${money(event.ticket_price)} <small style="font:400 .8rem var(--sans);color:var(--muted)">/ ticket</small></p><div class="panel-line"><i class="fa-regular fa-calendar"></i> ${escapeHtml(dateLabel(event.event_date))} · ${escapeHtml(String(event.start_time).slice(0, 5))}</div><div class="panel-line"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(event.venue)}, ${escapeHtml(event.city)}</div><div class="panel-line"><i class="fa-solid fa-ticket"></i> ${Number(event.available_tickets)} tickets available</div><a class="btn" style="width:100%;margin-top:17px" href="${root}booking.html?event=${encodeURIComponent(event.id)}">Book tickets</a><a class="btn btn-outline" style="width:100%;margin-top:9px" id="review-entry-link" href="#event-reviews">Write a review <i class="fa-regular fa-star"></i></a></aside>`;
            bindWishlist(target);
            loadReviewSection(event.id);
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    function starDisplay(rating) {
        return `<span class="star-display" aria-label="${Number(rating).toFixed(1)} out of 5 stars">${[1, 2, 3, 4, 5].map(star => `<i class="fa-${Number(rating) >= star ? 'solid' : 'regular'} fa-star"></i>`).join('')}</span>`;
    }

    function reviewFormMarkup(review = null) {
        const rating = Number(review?.rating || 5);
        return `<div class="review-form-panel" id="review-entry"><h3>${review ? 'Edit your review' : 'Share your experience'}</h3>${review ? `<p><span class="review-status ${escapeHtml(review.status)}">${escapeHtml(review.status)}</span> Waiting for organizer approval.</p>` : '<p>Submit your review as soon as your ticket payment is confirmed.</p>'}<form id="review-form" data-review-id="${review ? Number(review.id) : ''}"><input type="hidden" name="rating" value="${rating}"><div class="field"><label>Your rating</label><div class="star-picker" role="radiogroup" aria-label="Rating from one to five stars">${[1, 2, 3, 4, 5].map(star => `<button class="star-choice${star <= rating ? ' is-active' : ''}" type="button" data-rating="${star}" role="radio" aria-checked="${star === rating}" aria-label="${star} star${star === 1 ? '' : 's'}"><i class="fa-solid fa-star"></i></button>`).join('')}</div></div><div class="field"><label for="review-comment">Comment</label><textarea id="review-comment" name="comment" maxlength="3000" placeholder="What stood out about this event?">${escapeHtml(review?.comment || '')}</textarea></div><div class="review-form-actions"><button class="btn" type="submit">${review ? 'Update review' : 'Submit review'}</button>${review ? '<button class="btn btn-outline" type="button" id="delete-own-review">Delete review</button>' : ''}</div></form></div>`;
    }

    async function loadReviewSection(eventId) {
        const target = document.querySelector('#event-reviews'); if (!target) return;
        try {
            const data = await api(`/reviews/event/${eventId}`);
            const summary = data.summary;
            const distribution = [5, 4, 3, 2, 1].map(star => {
                const count = Number(summary.distribution[star] || 0);
                const width = summary.total ? count / summary.total * 100 : 0;
                return `<div class="review-distribution-row"><span>${star} <i class="fa-solid fa-star"></i></span><div class="review-bar"><span style="width:${width}%"></span></div><strong>${count}</strong></div>`;
            }).join('');
            const reviews = data.reviews.length ? data.reviews.map(review => `<article class="review-item"><div class="review-item-head"><div><strong>${escapeHtml(review.reviewer)}</strong><div>${starDisplay(review.rating)} ${review.status !== 'approved' ? `<span class="review-status ${escapeHtml(review.status)}">${escapeHtml(review.status)}</span>` : ''}</div></div><time datetime="${escapeHtml(review.created_at)}">${escapeHtml(dateLabel(review.created_at.slice(0, 10)))}</time></div><p>${escapeHtml(review.comment || 'Rated without a written comment.')}</p></article>`).join('') : `<div class="empty-state">${data.my_review ? `Your review is ${escapeHtml(data.my_review.status)} and will appear here after the organizer approves it.` : 'No approved reviews yet. Be the first to share your experience.'}</div>`;
            let form = '';
            if (currentUser?.role === 'attendee' && (data.my_review || data.can_review)) form = reviewFormMarkup(data.my_review);
            else if (!currentUser) form = `<div class="review-form-panel" id="review-entry"><h3>Share your experience</h3><p>Sign in and complete a ticket payment to leave a review.</p><a class="btn btn-small" href="${root}login.html">Sign in</a></div>`;
            else if (currentUser.role === 'attendee') form = '<div class="review-form-panel" id="review-entry"><h3>Payment required</h3><p>Complete payment for a ticket to this event. You can review it as soon as checkout confirms your payment.</p></div>';
            target.innerHTML = `<p class="section-kicker">Attendee feedback</p><h2 class="section-title">Reviews</h2><div class="review-summary"><div class="review-score"><strong>${Number(summary.average).toFixed(1)}</strong><div>${starDisplay(summary.average)}<div class="detail-description">${Number(summary.total)} approved review${Number(summary.total) === 1 ? '' : 's'}</div></div></div><div class="review-distribution">${distribution}</div></div><div class="review-layout"><div class="review-list">${reviews}</div>${form}</div>`;
            const reviewEntryLink = document.querySelector('#review-entry-link');
            if (reviewEntryLink) {
                if (!currentUser) {
                    reviewEntryLink.href = `${root}login.html`;
                    reviewEntryLink.innerHTML = 'Sign in to review <i class="fa-regular fa-star"></i>';
                } else if (currentUser.role !== 'attendee') {
                    reviewEntryLink.href = '#review-entry';
                    reviewEntryLink.innerHTML = 'Attendee reviews <i class="fa-regular fa-star"></i>';
                } else if (data.my_review) {
                    reviewEntryLink.href = '#review-entry';
                    reviewEntryLink.innerHTML = `${data.my_review.status === 'pending' ? 'Review pending organizer approval' : 'Edit your review'} <i class="fa-regular fa-star"></i>`;
                } else if (data.can_review) {
                    reviewEntryLink.href = '#review-entry';
                    reviewEntryLink.innerHTML = 'Write a review <i class="fa-regular fa-star"></i>';
                } else {
                    reviewEntryLink.href = '#review-entry';
                    reviewEntryLink.innerHTML = 'Pay for a ticket to review <i class="fa-regular fa-star"></i>';
                }
            }
            bindReviewForm(target, eventId);
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    function bindReviewForm(target, eventId) {
        const form = target.querySelector('#review-form'); if (!form) return;
        const ratingInput = form.elements.rating;
        form.querySelectorAll('.star-choice').forEach(button => button.addEventListener('click', () => {
            const rating = Number(button.dataset.rating);
            ratingInput.value = String(rating);
            form.querySelectorAll('.star-choice').forEach(choice => {
                const active = Number(choice.dataset.rating) <= rating;
                choice.classList.toggle('is-active', active);
                choice.setAttribute('aria-checked', String(Number(choice.dataset.rating) === rating));
            });
        }));
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const reviewId = form.dataset.reviewId;
            try {
                const body = JSON.stringify({ event_id: eventId, rating: ratingInput.value, comment: form.elements.comment.value });
                await api(reviewId ? `/reviews/${reviewId}` : '/reviews', { method: reviewId ? 'PUT' : 'POST', body });
                toast(reviewId ? 'Review updated and sent to the organizer.' : 'Review submitted to the organizer for approval.');
                loadReviewSection(eventId);
            } catch (error) { toast(error.message, true); }
        });
        form.querySelector('#delete-own-review')?.addEventListener('click', async () => {
            if (!confirm('Delete your review?')) return;
            try { await api(`/reviews/${form.dataset.reviewId}`, { method: 'DELETE' }); toast('Review deleted.'); loadReviewSection(eventId); }
            catch (error) { toast(error.message, true); }
        });
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
                    document.querySelector('#booking-result').innerHTML = `<div class="notice" style="background:#e5eddc;color:#315b43"><strong>Booking confirmed.</strong><br>Reference ${escapeHtml(payment.booking_reference)} · ${money(payment.amount)}<br><small>Demo payment only. No real money was charged.</small></div><div class="review-form-actions"><a class="btn" href="${root}event-details.html?id=${encodeURIComponent(event.id)}#review-entry">Write a review now</a><a class="btn btn-outline" href="${root}dashboard/user/index.html">View your tickets</a></div>`;
                    form.hidden = true;
                } catch (error) { toast(error.message, true); }
            });
        } catch (error) { document.querySelector('#booking-summary').textContent = error.message; }
    }

    async function initUserDashboard() {
        const target = document.querySelector('#user-bookings'); if (!target) return;
        try {
            const data = await api('/bookings');
            target.innerHTML = data.bookings.length ? `<div class="table-wrap"><table><thead><tr><th>Event</th><th>Date</th><th>Tickets</th><th>Total</th><th>Status</th><th>Ticket reference</th><th></th></tr></thead><tbody>${data.bookings.map(item => `<tr><td><a class="text-link" href="${root}event-details.html?id=${Number(item.event_id)}">${escapeHtml(item.title)}</a></td><td>${escapeHtml(dateLabel(item.event_date))}</td><td>${Number(item.quantity)}</td><td>${money(item.total_amount)}</td><td><span class="status">${escapeHtml(item.status.replace('_', ' '))}</span></td><td>${escapeHtml(item.reference)}</td><td>${item.status === 'confirmed' ? `<button class="btn btn-small btn-outline cancel-booking" data-id="${item.id}">Cancel</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No tickets yet. Your next good story is out there.</div>';
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

    function wishlistCard(event) {
        return `<article class="event-card"><div class="event-image-wrap"><img class="event-image" src="${escapeHtml(eventImage(event))}" alt="${escapeHtml(event.title)}" loading="lazy"><button class="wishlist-toggle is-saved" type="button" data-event-id="${Number(event.id)}" aria-label="Remove from wishlist: ${escapeHtml(event.title)}" aria-pressed="true"><i class="fa-solid fa-heart"></i></button></div><div class="event-content"><div class="event-meta">${escapeHtml(event.category)}</div><h2 class="event-title">${escapeHtml(event.title)}</h2><div class="event-info"><span><i class="fa-regular fa-calendar"></i>${escapeHtml(dateLabel(event.event_date))} · ${escapeHtml(String(event.start_time).slice(0, 5))}</span><span><i class="fa-solid fa-location-dot"></i>${escapeHtml(event.venue)}, ${escapeHtml(event.city)}</span><span><i class="fa-solid fa-ticket"></i>${money(event.ticket_price)}</span></div><div class="event-bottom"><a class="btn btn-small" href="${root}event-details.html?id=${Number(event.id)}">View details</a><button class="btn btn-small btn-outline wishlist-remove" type="button" data-event-id="${Number(event.id)}">Remove</button></div></div></article>`;
    }

    async function initWishlist() {
        const target = document.querySelector('#wishlist-events'); if (!target) return;
        try {
            const data = await api('/wishlist');
            target.innerHTML = data.events.length ? data.events.map(wishlistCard).join('') : '<div class="empty-state"><i class="fa-regular fa-heart"></i><h3>Your wishlist is empty</h3><p>Tap the heart on an event to save it for later.</p><a class="btn btn-small" href="../../events.html">Explore events</a></div>';
            bindWishlist(target);
            if (!target.dataset.removeBound) {
                target.dataset.removeBound = 'true';
                target.addEventListener('click', async event => {
                    const button = event.target.closest('.wishlist-remove'); if (!button) return;
                    if (!confirm('Remove this event from your wishlist?')) return;
                    try { await api(`/wishlist/${button.dataset.eventId}`, { method: 'DELETE' }); toast('Event removed from wishlist.'); initWishlist(); }
                    catch (error) { toast(error.message, true); }
                });
                target.addEventListener('wishlist:changed', () => initWishlist());
            }
        } catch (error) {
            target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
        }
    }

    async function initMyReviews() {
        const target = document.querySelector('#my-reviews'); if (!target) return;
        try {
            const data = await api('/reviews/my-reviews');
            target.innerHTML = data.reviews.length ? `<div class="review-list">${data.reviews.map(review => `<article class="review-item"><div class="review-item-head"><div><p class="event-meta">${escapeHtml(review.category)}</p><h2 class="event-title">${escapeHtml(review.title)}</h2><div>${starDisplay(review.rating)} <span class="review-status ${escapeHtml(review.status)}">${escapeHtml(review.status)}</span></div></div><time datetime="${escapeHtml(review.created_at)}">${escapeHtml(dateLabel(review.created_at.slice(0, 10)))}</time></div><p>${escapeHtml(review.comment || 'Rated without a written comment.')}</p><div class="review-form-actions" style="margin-top:16px"><a class="btn btn-small" href="../../event-details.html?id=${Number(review.event_id)}">Edit review</a><button class="btn btn-small btn-outline delete-my-review" type="button" data-id="${Number(review.id)}">Delete</button></div></article>`).join('')}</div>` : '<div class="empty-state"><i class="fa-regular fa-star"></i><h3>No reviews yet</h3><p>After attending an event, you can leave a rating and review.</p></div>';
            if (!target.dataset.bound) {
                target.dataset.bound = 'true';
                target.addEventListener('click', async event => {
                    const button = event.target.closest('.delete-my-review'); if (!button || !confirm('Delete this review?')) return;
                    try { await api(`/reviews/${button.dataset.id}`, { method: 'DELETE' }); toast('Review deleted.'); initMyReviews(); }
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
        initOrganizerReviews();
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

    function initOrganizerReviews() {
        const target = document.querySelector('#organizer-reviews'); if (!target) return;
        const form = document.querySelector('#organizer-review-filters');
        if (form && !form.dataset.bound) {
            form.dataset.bound = 'true';
            form.addEventListener('submit', event => { event.preventDefault(); loadOrganizerReviews(); });
        }
        if (!target.dataset.bound) {
            target.dataset.bound = 'true';
            target.addEventListener('click', async event => {
                const button = event.target.closest('.organizer-review-status'); if (!button) return;
                try {
                    await api(`/organizer/reviews/${button.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) });
                    toast(`Review ${button.dataset.status}.`);
                    loadOrganizerReviews();
                } catch (error) { toast(error.message, true); }
            });
        }
        loadOrganizerReviews();
    }

    async function loadOrganizerReviews() {
        const target = document.querySelector('#organizer-reviews'); if (!target) return;
        const form = document.querySelector('#organizer-review-filters');
        const params = form ? new URLSearchParams(new FormData(form)) : new URLSearchParams();
        for (const [key, value] of [...params]) if (!value) params.delete(key);
        try {
            const data = await api(`/organizer/reviews${params.size ? `?${params}` : ''}`);
            target.innerHTML = data.reviews.length ? `<div class="table-wrap"><table><thead><tr><th>Event</th><th>Attendee</th><th>Rating</th><th>Comment</th><th>Status</th><th>Permission</th></tr></thead><tbody>${data.reviews.map(review => `<tr><td>${escapeHtml(review.event_title)}</td><td>${escapeHtml(review.reviewer)}</td><td>${Number(review.rating)} / 5</td><td>${escapeHtml(review.comment || '—')}</td><td><span class="review-status ${escapeHtml(review.status)}">${escapeHtml(review.status)}</span></td><td><button class="btn btn-small organizer-review-status" data-id="${Number(review.id)}" data-status="approved">Approve</button> <button class="btn btn-small btn-outline organizer-review-status" data-id="${Number(review.id)}" data-status="rejected">Reject</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No reviews on your events yet.</div>';
        } catch (error) { target.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`; }
    }

    async function initAdminDashboard() {
        const stats = document.querySelector('#admin-stats'); if (!stats) return;
        try {
            const data = await api('/admin/dashboard');
            stats.innerHTML = Object.entries({ 'Attendees': data.stats.users, 'Organizers': data.stats.organizers, 'Published events': data.stats.events, 'Confirmed bookings': data.stats.bookings, 'Demo revenue': money(data.stats.revenue), 'Needs review': data.stats.pending_events }).map(([label, value]) => `<div class="dashboard-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
            document.querySelector('#admin-bookings').innerHTML = data.recent_bookings.map(row => `<tr><td>${escapeHtml(row.reference)}</td><td>${escapeHtml(row.attendee)}</td><td>${escapeHtml(row.title)}</td><td>${money(row.total_amount)}</td><td>${escapeHtml(row.status)}</td></tr>`).join('');
            loadAdminEvents(); loadAdminUsers(); loadAdminReports(); loadAdminMessages(); initAdminCategories(); initAdminReviews();
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

    async function initAdminReviews() {
        const target = document.querySelector('#admin-reviews'); if (!target) return;
        const form = document.querySelector('#review-filters');
        if (form && !form.dataset.bound) {
            form.dataset.bound = 'true';
            form.addEventListener('submit', event => { event.preventDefault(); loadAdminReviews(); });
        }
        loadAdminReviews();
    }

    async function loadAdminReviews() {
        const target = document.querySelector('#admin-reviews'); if (!target) return;
        const form = document.querySelector('#review-filters');
        const params = form ? new URLSearchParams(new FormData(form)) : new URLSearchParams();
        for (const [key, value] of [...params]) if (!value) params.delete(key);
        try {
            const data = await api(`/admin/reviews${params.size ? `?${params}` : ''}`);
            target.innerHTML = data.reviews.length ? `<div class="table-wrap"><table><thead><tr><th>Event</th><th>Reviewer</th><th>Rating</th><th>Comment</th><th>Status</th><th>Moderate</th></tr></thead><tbody>${data.reviews.map(review => `<tr><td>${escapeHtml(review.event_title)} <small>#${Number(review.event_id)}</small></td><td>${escapeHtml(review.reviewer)}<br><small>${escapeHtml(review.email)}</small></td><td>${Number(review.rating)} / 5</td><td>${escapeHtml(review.comment || '—')}</td><td><span class="review-status ${escapeHtml(review.status)}">${escapeHtml(review.status)}</span></td><td><button class="btn btn-small review-moderate" data-id="${Number(review.id)}" data-status="approved">Approve</button> <button class="btn btn-small btn-outline review-moderate" data-id="${Number(review.id)}" data-status="rejected">Reject</button> <button class="btn btn-small btn-outline review-delete" data-id="${Number(review.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No reviews match these filters.</div>';
            if (!target.dataset.bound) {
                target.dataset.bound = 'true';
                target.addEventListener('click', async event => {
                    const moderate = event.target.closest('.review-moderate');
                    const remove = event.target.closest('.review-delete');
                    try {
                        if (moderate) {
                            await api(`/admin/reviews/${moderate.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: moderate.dataset.status }) });
                            toast(`Review ${moderate.dataset.status}.`);
                        } else if (remove && confirm('Permanently remove this review?')) {
                            await api(`/admin/reviews/${remove.dataset.id}`, { method: 'DELETE' });
                            toast('Review removed.');
                        } else return;
                        loadAdminReviews();
                    } catch (error) { toast(error.message, true); }
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
        initHome(); initEvents(); initDetails(); initAuth(); initBooking(); initUserDashboard(); initOrganizerDashboard(); initAdminDashboard(); initNotifications(); initContact(); initProfile(); initWishlist(); initMyReviews();
    });
})();