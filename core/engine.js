// Sea shanty 2 is my jam
const $ = require('jquery');
const md5 = require('md5');
const pell = require('pell');
const toastr = require('toastr');

// Client code
$(document).ready(() => {

    /////////////
    // GLOBALS //
    /////////////

    // Initialise the DOM with the templates
    const head = $('head');
    const body = $('body');

    const headContent = require('../content/includes/head.html');
    const bodyContent = require('../content/includes/body.html');

    head.prepend($.parseHTML(headContent));
    body.prepend($.parseHTML(bodyContent));

    // DOM Elements

    // OCMS CSS
    var toastrCSS = $(document.createElement('link'));
    toastrCSS.attr('rel', 'stylesheet');
    toastrCSS.attr('href', '/ocms.css');
    head.append(toastrCSS);

    // Split the page into content and editor
    const contentEditor = $(document.createElement('div'));
    contentEditor.attr('id', 'pell-content-editor');
    $('#page').append(contentEditor);

    const pageContent = $(document.createElement('div'));
    var originalContent = '';
    pageContent.attr('id', 'page-content');
    $('#page').append(pageContent);

    // Prevent rapid switching between pages before animation has finished
    var inTransition = false;

    // WYSIWYG variables
    var
    onErrorPage = false,
    editor = null,
    editing = false,
    currentEditorTarget = '',
    editButton = $(document.createElement('div')),
    onHover = (e) => {
        // If we're on an error page, don't show the edit button
        if(onErrorPage) {
            return;
        }

        editButton.show();
        editButton.css({
            'top': pageContent.offset().top,
            'left': pageContent.offset().left + pageContent.width() - 100,
        });
    },
    onLeave = (e) => {
        // If we're on an error page, don't show the edit button
        if(onErrorPage) {
            return;
        }

        if(!editing) {
            editButton.hide();
        }
    };

    //////////////////
    // PAGE LOADING //
    //////////////////

    // Load a page from a path
    const loadPage = (path) => {
        // Fetch function
        const fetchAndRenderPage = (path) => {
            // Load page into dom function
            const putPageInDOM = (json) => {
                // Set the current target
                currentEditorTarget = json.target;
                console.log('[Client] Current editor target: ' + currentEditorTarget);

                // Put the page in the DOM
                inTransition = true;
                pageContent.fadeOut(() => {
                    originalContent = json.template;
                    pageContent.html(json.template);
                    pageContent.fadeIn(() => {
                        inTransition = false;
                    });
                });
            };

            // Fetch logic
            return fetch(`/api/page/${path}`)
                    .then((res) => {
                        return res.json()
                            .then((json) => {
                                // Check for hash difference
                                var hashDiff = fetch(`/api/page/${path}`, { headers: { 'X-Hash-Only': 'true' } })
                                                .then((res2) => {
                                                    return res2.text();
                                                })
                                                .then((hash) => {
                                                    const liveHash = hash;
                                                    const localHash = md5(json.template);

                                                    putPageInDOM(json);

                                                    // If hashes don't match, display warning
                                                    if(liveHash !== localHash) {
                                                        toastr.error('You may not be viewing the latest version of this page!');
                                                    }
                                                })
                                                .catch((err) => {
                                                    putPageInDOM(json);
                                                });
                            })
                            .catch((err) => {
                                // If the response JSON was null, we're probably offline
                                onErrorPage = true;
                                putPageInDOM({
                                    target: '',
                                    template: '<h1>408 Request Timeout</h1><p>The page you are trying to access is not cached and additionally, no connection to the server is available. Please try again when you are connected to the internet.</p>',
                                });
                            });
                    });
        };

        // Don't do anything if we're still in transition
        if(inTransition) {
            return;
        }

        // Give user prompt if they are trying to navigate whilst editing
        if(editing) {
            // If they say no, stay on the page
            if(!confirm('You may have unsaved changes! Are you sure you want to navigate away?')) {
                return;
            }
            // Otherwise, hide the editor and the edit button
            $(editor).hide();
            editButton.hide();
            editButton.html('Edit content');
            editing = false;
        }

        // Push to history
        history.pushState({}, '', path);

        // Make the path the correct format
        path = path.replace(/\//g, '.').substr(1);

        if(window.ocms.usingServiceWorker) {
            fetchAndRenderPage(path)
                .catch((err) => console.log(err));
        }
        else {
            // Storage
            const cache = (key, value) => {
                window.localStorage.setItem('ocms-' + key, value);
            };
            const getCache = (key) => {
                return window.localStorage.getItem('ocms-' + key);
            };

            // Grab the page from the cache
            const page = getCache('page-' + path);
            if(page) {
                pageContent.fadeOut(() => {
                    pageContent.html(page);
                    pageContent.fadeIn();
                });
            }
            // Otherwise fetch it
            else {
                fetchAndRenderPage(path)
                    .then(() => cache('page-' + path, text))
                    .catch((err) => console.log(err));
            }
        }
    };

    // Setup the history pop event so we can navigate properly when back/forward are pressed
    window.onpopstate = (e) => loadPage(window.location.pathname);

    // Get the initial page from the current window location but replace '/' with '.' (for URL safety)
    // Also remove the leading '/'
    // (our API will parse the dots correctly)
    loadPage(window.location.pathname);

    // Hijack all 'a hrefs' on the site so they use cache/fetch instead of GET
    $(document).click((e) => {
        // If link was clicked
        if($(e.target).is('a[href]')) {
            var
            a = $(e.target),
            href = a.attr('href');

            // If the page isn't an external one
            if(!href.startsWith('http://') &&
                !href.startsWith('https://') &&
                !href.startsWith('//')) {
                    // Don't follow the link normally - we're gonna use our own method
                    e.preventDefault();

                    // If there's no leading slash, add one (otherwise it'll mess stuff up)
                    href = href.startsWith('/') ? href : '/' + href;

                    // Check we're not already on the page then load it
                    if(window.location.pathname != href) {
                        loadPage(href);
                    }
            }
        }
    });

    //////////////////////////////////
    // OUTDATED ENGINE NOTIFICATION //
    //////////////////////////////////
    if(window.ocms.engineIsOutdated) {
        toastr.warning(
            // Body text
            'Click me to update!',
            // Title
            'Local architecture is different from live server version!',
            // Options
            {
                timeOut: 10000000, // Display for a long time
                extendedTimeOut: 10000000, // Display for a long time
                positionClass: 'toast-top-left',
                onclick: () => {
                    // Unregister the service worker and refresh the page
                    window.ocms.swRegistrationObject
                        .unregister()
                        .then((success) => {
                            if(success) {
                                window.ocms.storage.removeItem(window.ocms.param('version'));
                                window.location.reload(true);
                            }
                            else {
                                console.log('[ERR] COULD NOT UNREGISTER SERVICE WORKER');
                            }
                        });
                }
            }
        );
    }

    ////////////////////
    // WYSIWYG EDITOR //
    ////////////////////

    // Add to the DOM
    body.append(editButton);

    // Style the edit button
    editButton.attr('id', 'edit-button');
    editButton.html('Edit content');
    editButton.css({
        'display': 'none',
        'position': 'fixed',
        'border': '2px solid #6495ED',
        'border-radius': '3px',
        'padding': '8px 12px',
        'font-weight': 'bold',
        'cursor': 'pointer',
    });

    pageContent.hover(onHover, onLeave);
    editButton.hover(onHover, onLeave);

    editButton.click((e) => {
        // If the engine is outdated, disallow editing
        if(window.ocms.engineIsOutdated) {
            toastr.warning('Local version of architecture is outdated; editing is disabled.');
            return;
        }

        // Toggle the editing status
        editing = !editing;

        // Show the editor
        if(editing) {
            // Update the text
            editButton.html('Hide editor');

            // Initialise the editor if we haven't already then show it
            if(editor === null) {
                // Create pell editor
                editor = pell.init({
                    element: document.getElementById('pell-content-editor'),
                    defaultParagraphSeparator: 'p',
                    actions: [ 'bold', 'italic', 'underline', 'strikethrough', 'paragraph', 'heading1', 'heading2', 'olist', 'ulist', 'quote', 'code', 'line', 'link', 'image' ],
                    onChange: html => {
                        pageContent.html(html);
                    }
                });

                // Add additional buttons to save/discard
                var saveButton = $(document.createElement('button')),
                    discardButton = $(document.createElement('button'));

                saveButton.addClass('pell-button pell-cta-button');
                saveButton.html('Save Content');
                saveButton.css({
                    'float': 'right',
                    'width': '115px',
                    'background-color': '#228B22',
                    'color': '#FFF',
                });

                discardButton.addClass('pell-button pell-cta-button');
                discardButton.html('Discard Changes');
                discardButton.css({
                    'float': 'right',
                    'width': '115px',
                    'background-color': '#DC143C',
                    'color': '#FFF',
                });

                discardButton.click((e) => {
                    if(confirm('Are you sure you want to discard your changes? (THIS ACTION CANNOT BE REVERSED!)')) {
                        pageContent.html(originalContent);
                        editor.content.innerHTML = originalContent;
                    }
                });

                saveButton.click((e) => {
                    // Blank param to fetch the current page
                    var postPath = window.location.origin + '/api/page/' + (window.location.pathname.replace(/\//g, '.').substr(1));
                    fetch(postPath, {
                        body: JSON.stringify({
                            content: editor.content.innerHTML,
                            target: currentEditorTarget,
                        }),
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        method: 'POST',
                    }).then((res) => {
                        toastr.success('Save successful!');
                        editButton.html('Edit content');
                        contentEditor.hide();
                    }).catch((err) => {
                        toastr.error('Error saving changes! If this problem persists, please take a local backup and try again later.');
                    });
                });

                $('.pell-actionbar').append(discardButton);
                $('.pell-actionbar').append(saveButton);
            }

            // Initialise the editor content with existing page content
            editor.content.innerHTML = pageContent.html();

            // Show it!
            contentEditor.show();
        }
        // Hide the editor if we're toggling it off
        else {
            // Update the text
            editButton.html('Edit content');
            contentEditor.hide();
        }

        // Trigger the onHover event to update the position of the button immediately
        onHover();
    });

});
