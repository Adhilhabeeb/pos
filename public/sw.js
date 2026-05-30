const CACHE_NAME = 'dailynest-pos-images-v1';

// Install event - skip waiting to activate immediately
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Activate event - claim clients to start intercepting right away
self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  
  // Cache check for image destinations or files ending with key image extensions
  const isImageRequest = 
    event.request.destination === "image" || 
    url.pathname.match(/\.(png|jpe?g|gif|svg|webp|bmp|tiff)i?(\?.*)?$/i);

  // Only intercept HTTP/HTTPS scheme to avoid extensions, dev-server websockets, or chrome-internal errors
  if (isImageRequest && url.protocol.startsWith('http')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          // Fetch from network to retrieve the resource
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              // Cache a copy for future requests
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(err => {
            // Silence network errors if we already got it cached
            if (cachedResponse) return cachedResponse;
            throw err;
          });

          // Stale-while-revalidate strategy:
          // Immediately return cached resource from memory/disk (0.1ms load),
          // while fetching latest version in the background. If none in cache, wait for fetchPromise.
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
