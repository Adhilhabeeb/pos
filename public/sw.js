self.addEventListener("fetch", event => {
  if (event.request.destination === "image") {
    event.respondWith(
      caches.open("images").then(async cache => {
        const cached = await cache.match(event.request);

        if (cached) {
          return cached;
        }

        const response = await fetch(event.request);

        cache.put(event.request, response.clone());

        return response;
      })
    );
  }
});