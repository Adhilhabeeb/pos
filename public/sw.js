self.addEventListener("fetch", event => {
  if (event.request.destination === "image") {
    event.respondWith(
      caches.open("images").then(async cache => {
        const cached = await cache.match(event.request);

        if (cached) {
          console.log("CACHE HIT:", event.request.url);
          return cached;
        }

        console.log("CACHE MISS:", event.request.url);

        const response = await fetch(event.request);

        cache.put(event.request, response.clone());

        console.log("CACHED:", event.request.url);

        return response;
      })
    );
  }
});