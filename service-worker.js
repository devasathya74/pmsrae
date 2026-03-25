// Service Worker for PWA
const CACHE_NAME = 'pms-raebareli-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/assets/css/main.css',
    '/assets/js/main.js',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                // Only cache local resources, skip external CDNs during install
                const localUrls = urlsToCache.filter(url => !url.startsWith('http'));
                return cache.addAll(localUrls).catch(err => {
                    console.warn('Failed to cache some resources:', err);
                });
            })
    );
});

// Fetch strategy
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip non-http and analytics/firebase
    if (!event.request.url.startsWith('http') ||
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('google-analytics.com') ||
        url.hostname.includes('firebase')) {
        return;
    }

    // HTML: Network First, falling back to cache
    if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(event.request).then(response => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                return response;
            }).catch(() => caches.match(event.request))
        );
        return;
    }

    // Static Assets: Cache First, falling back to network
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                }
                return networkResponse;
            });
        })
    );
});

// Update Service Worker
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Background sync for form submissions
self.addEventListener('sync', event => {
    if (event.tag === 'sync-forms') {
        event.waitUntil(syncForms());
    }
});

async function syncForms() {
    // Implement form sync logic here
    console.log('Syncing forms...');
}

// Push notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New notification from PMS Raebareli',
        icon: '/assets/images/logo/icon-192x192.png',
        badge: '/assets/images/logo/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'View',
                icon: '/assets/images/logo/icon-96x96.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/assets/images/logo/icon-96x96.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('PMS Raebareli', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});
