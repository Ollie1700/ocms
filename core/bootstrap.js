/**
 * --------------
 * OCMS Bootstrap
 * --------------
 *
 */

window.ocms = {

    usingServiceWorker: false,

    storage: window.localStorage,

    engineIsOutdated: false,

    swRegistrationObject: null,

    param: (param) => {
        return 'ocms-' + param;
    },

    load: (js) => {
        const script = document.createElement('script');
        script.innerHTML = js;
        document.getElementsByTagName('body')[0].appendChild(script);
    },

};

// USE SERVICE WORKERS IF THEY EXIST
if('serviceWorker' in navigator) {
    // Register the service worker
    navigator.serviceWorker
        .register('./service-worker.js', { scope: './' })
        .then((registration) => {
            console.log('[Service Worker] Successfully registered!');
            window.ocms.usingServiceWorker = true;

            // Store the registration object
            window.ocms.swRegistrationObject = registration;

            // Get the version of OCMS
            fetch('/api/version')
                .then((res) => {
                    var localVersion = window.ocms.storage.getItem(window.ocms.param('version'));
                    return res.text()
                        .then((version) => {
                            // If it's the first time we're downloading, store the version
                            if(localVersion === null) {
                                window.ocms.storage.setItem(window.ocms.param('version'), version);
                                localVersion = version;
                            }

                            console.log('[Server] Version: ' + localVersion);
                            console.log('[Service Worker] Version: ' + version);

                            // If the local version doesn't match the live, set a flag
                            if(localVersion !== version) {
                                window.ocms.engineIsOutdated = true;
                            }

                            // If we're utilising service workers, we simply want to fetch the
                            // download, since the caching will be handled for us
                            console.log('download pls...');
                            fetch('/api/download')
                                .then((res) => {
                                    return res.text()
                                            .then((js) => {
                                                console.log('downlod.... PLEASE??' + js);
                                                window.ocms.load(js);
                                            });
                                });
                        })
                        .catch((err) => {
                            return localVersion;
                        });
                })
        })
        .catch((err) => {
            console.log('[Service Worker] Failed to register: ', err);
        });
}
// Otherwise use local storage
else {
    // Get the version of OCMS
    fetch('/api/version')
        .then((res) => {
            return res.text();
        })
        .then((version) => {
            console.log('OCMS Version: ' + version);

            const localVersion = window.ocms.storage.getItem(window.ocms.param('version'));

            // If we don't have our JS in storage, OR if our version is outdated.
            // Bare in mind, if it isn't in local storage, it could imply we're
            // utilising service workers instead of local storage.
            if(!localVersion || localVersion !== version) {

                // Get the new version of the app
                fetch('/api/download')
                    .then((res) => {
                        return res.text();
                    })
                    .then((js) => {
                        // Save the version and app to storage
                        window.ocms.storage.setItem(window.ocms.param('version'), version);
                        window.ocms.storage.setItem(window.ocms.param('js'), js);
                        window.ocms.load(window.ocms.storage.getItem(window.ocms.param('js')));
                    });

            }
            // If we have the latest version in storage, use it
            else {
                window.ocms.load(window.ocms.storage.getItem(window.ocms.param('js')));
            }
        });
}
