/**
 * ------------------
 * The Service Worker
 * ------------------
 * Lorem ipsum....
 *
 */

// GLOBALS //
var
semver = 'x.x.x',
url = '';
// END GLOBALS //

// HELPERS //
var
echo = function() {
    var output = `[Service Worker ${semver}]`;
    for(var i = 0; i < arguments.length; i++) {
        output += ' ' + arguments[i];
    }
    console.log(output);
},
getAndCacheResponse = (e) => {
    return caches.match(e.request)
            .then((res) => {
                // If response is found in cache, simply return it
                if(res) {
                    return res;
                }

                // Request has already been consumed, so clone it to use it again
                var requestClone = e.request.clone();
                return fetch(requestClone)
                        .then((res) => {
                            // No response from server - client may be offline
                            if(!res) {
                                echo('No response from fetch', e.request.url);
                                return res;
                            }

                            // Clone response as it has needs to be consumed again
                            var resClone = res.clone();

                            // Insert server response into cache
                            return caches.open(semver).then((cache) => {
                                cache.put(e.request, resClone);
                                echo('New data cached', e.request.url);
                                return res;
                            });
                        })
                        .catch((err) => {
                            echo('Error fetching & cloning new data', err);
                            return new Response(null);
                        });
            });
};
// END HELPERS

// SERVICE WORKER LISTENERS //
self.addEventListener('install', (e) => {
    // Set the host URL
    url = e.srcElement.location.origin;

    // Get the current version
    e.waitUntil(
        fetch('/api/version')
            .then((res) => {
                return res.text();
            })
            .then((ver) => {
                semver = ver;
                // Open the cache with the current semver
                caches.open(semver).then((cache) => {
                    // Add the bootstrap to the cache
                    return cache.addAll([
                        './bootstrap.html',
                        './bootstrap.js',
                    ]);
                })
                // Uhh I think it worked?
                echo('Installed');
            })
            .catch((err) => {
                echo('Failed to get live API version. You may be offline.', err);
            })
    );
});

self.addEventListener('activate', (e) => {
    // Get the current version if possible then clear out old caches
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(cacheNames.map((thisCacheName) => {
                if(thisCacheName !== semver) {
                    echo('Removing old cache', thisCacheName);
                    return caches.delete(thisCacheName);
                }
            }));
        })
    );

    echo('Activated');

    // Do some magic stuff so that we don't have to refresh to intercept fetch events
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    // We only want to know about actual requests, not stuff from chrome-extension:// etc.
    if(e.request.url.startsWith('http')) {
        // Big ol' switch statement to deal with various use cases
        const requestIsInternal = e.request.url.includes(url);

        // Internal requests
        if(requestIsInternal) {
            const slug = e.request.url.split(url)[1];

            // If the user is requesting the hash
            if(e.request.headers.has('X-Hash-Only')) {
                echo('Internal hash fetch:', slug);
                var res = fetch(e.request).catch((err) => { return null; });
                e.respondWith(res ? res : new Response(null));

            }
            // Otherwise proceed normally with cache checking etc.
            else {
                echo('Internal fetch:', slug);

                // If it's a post, just forward it
                if(e.request.method === 'POST') {
                    var reqClone = e.request.clone();
                    e.respondWith(
                        fetch(e.request)
                        .then((res) => {
                            return reqClone.json();
                        })
                        .then((body) => {
                            return caches.open(semver).then((cache) => {
                                echo('Cache updated ', e.request.url);
                                return cache.put(
                                    new Request(e.request.url),
                                    new Response(
                                        new Blob(
                                            [
                                                JSON.stringify({
                                                    target: body.target,
                                                    template: body.content,
                                                })
                                            ],
                                            { type: 'application/json' }
                                        )
                                    )
                                );
                            });
                        })
                    );
                    return;
                }

                // Do different things depending on what is being requested
                switch(slug) {
                    case '/api/version':
                        // Get the version always direct from server
                        var res = fetch(e.request).catch((err) => { return null; });
                        console.log('version res: ');
                        console.log(res);
                        e.waitUntil(e.respondWith(res ? res : new Response(null)));
                        break;

                    default:
                        e.waitUntil(e.respondWith(getAndCacheResponse(e)));
                        break;
                }
            }
        }
        // External requests
        else {
            e.waitUntil(e.respondWith(getAndCacheResponse(e)));
        }
    }
});
// END SERVICE WORKER LISTENERS //
