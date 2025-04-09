// tab-session.js - Enhanced tab-specific session management
(function() {
    // Skip on login and signup pages where we'll handle tab IDs differently
    if (window.location.pathname === '/login' || window.location.pathname === '/signup') {
        // For login/signup pages, still ensure a tab ID is present in the URL
        const url = new URL(window.location.href);
        if (!url.searchParams.has('tabId')) {
            // Generate a unique ID for this tab that persists across page loads
            let tabId = sessionStorage.getItem('campusmatch_tab_id');
            if (!tabId) {
                tabId = Date.now() + '-' + Math.random().toString(36).substring(2, 15);
                sessionStorage.setItem('campusmatch_tab_id', tabId);
            }
            url.searchParams.set('tabId', tabId);
            window.history.replaceState({}, '', url.toString());
        } else {
            // Store the existing tab ID
            sessionStorage.setItem('campusmatch_tab_id', url.searchParams.get('tabId'));
        }
        return;
    }
    
    // Ensure we have a tab ID from somewhere
    const tabId = getTabId();
    console.log(`Tab Session Manager: Tab ID = ${tabId}`);
    
    // Store tab ID in sessionStorage
    sessionStorage.setItem('campusmatch_tab_id', tabId);
    
    // Get user ID from data attribute
    const userId = document.body.dataset.userId;
    if (userId) {
        console.log(`Tab Session Manager: User ID = ${userId}`);
        sessionStorage.setItem('campusmatch_user_id', userId);
    }
    
    // Update all links on the page
    updateAllLinks();
    
    // Add tab ID to all fetch requests
    interceptFetch();
    
    // Add tab ID to all XHR requests
    interceptXHR();
    
    // Add tab ID to all form submissions
    interceptForms();
    
    // Functions
    
    // Get tab ID from URL, sessionStorage, data attribute, or generate new one
    function getTabId() {
        const urlTabId = getTabIdFromUrl();
        const sessionTabId = sessionStorage.getItem('campusmatch_tab_id');
        const dataTabId = document.body.dataset.tabId;
        
        // Use existing tab ID or generate new one
        const tabId = urlTabId || sessionTabId || dataTabId || generateNewTabId();
        
        // If the tab ID wasn't in the URL, add it now
        if (!urlTabId) {
            const url = new URL(window.location.href);
            url.searchParams.set('tabId', tabId);
            window.history.replaceState({}, '', url.toString());
        }
        
        return tabId;
    }
    
    // Get tab ID from URL query parameters
    function getTabIdFromUrl() {
        const url = new URL(window.location.href);
        return url.searchParams.get('tabId');
    }
    
    // Generate a new unique tab ID
    function generateNewTabId() {
        return Date.now() + '-' + Math.random().toString(36).substring(2, 15);
    }
    
    // Add tab ID to all links on the page
    function updateAllLinks() {
        // First get all internal links (those that start with / or the same origin)
        const links = document.querySelectorAll('a[href^="/"]:not([href^="//"])');
        links.forEach(link => {
            try {
                const url = new URL(link.href, window.location.origin);
                
                // Skip if this is an anchor link to the same page
                if (url.pathname === window.location.pathname && url.hash) {
                    return;
                }
                
                // Add tab ID if not already present
                if (!url.searchParams.has('tabId')) {
                    url.searchParams.set('tabId', tabId);
                    link.href = url.toString();
                }
            } catch (e) {
                console.error('Error updating link', link, e);
            }
        });
    }
    
    // Intercept fetch requests to add tab ID
    function interceptFetch() {
        const originalFetch = window.fetch;
        window.fetch = function(resource, options = {}) {
            let url;
            
            // Handle different types of resource parameter
            if (typeof resource === 'string') {
                // Parse the URL
                url = new URL(resource, window.location.origin);
            } else if (resource instanceof Request) {
                // Clone the request to avoid modifying the original
                const request = resource.clone();
                url = new URL(request.url, window.location.origin);
            } else {
                // If resource is neither string nor Request, pass through
                return originalFetch.call(this, resource, options);
            }
            
            // Add tab ID if not already present
            if (!url.searchParams.has('tabId')) {
                url.searchParams.set('tabId', tabId);
            }
            
            // Add headers
            options = options || {};
            options.headers = options.headers || {};
            options.headers['X-Tab-ID'] = tabId;
            
            // Call original fetch with modified URL and options
            if (typeof resource === 'string') {
                return originalFetch.call(this, url.toString(), options);
            } else {
                const modifiedRequest = new Request(url.toString(), {
                    ...resource,
                    headers: {
                        ...resource.headers,
                        'X-Tab-ID': tabId
                    }
                });
                return originalFetch.call(this, modifiedRequest, options);
            }
        };
    }
    
    // Intercept XHR requests to add tab ID
    function interceptXHR() {
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            // Parse the URL
            let modifiedUrl;
            try {
                modifiedUrl = new URL(url, window.location.origin);
                
                // Add tab ID as a query parameter if not already present
                if (!modifiedUrl.searchParams.has('tabId')) {
                    modifiedUrl.searchParams.set('tabId', tabId);
                }
                
                // Call original open with the modified URL
                originalOpen.call(this, method, modifiedUrl.toString(), async === undefined ? true : async, user, password);
            } catch (e) {
                // If URL parsing fails, use original URL
                originalOpen.call(this, method, url, async === undefined ? true : async, user, password);
            }
            
            // Add tab ID header
            this.setRequestHeader('X-Tab-ID', tabId);
        };
    }
    
    // Intercept form submissions to add tab ID
    function interceptForms() {
        document.addEventListener('submit', function(e) {
            const form = e.target;
            
            // Skip if we're already processing a form
            if (form.dataset.tabHandled) {
                return;
            }
            
            form.dataset.tabHandled = 'true';
            
            // Check if this form already has our hidden field
            let tabIdInput = Array.from(form.elements).find(el => el.name === 'tabId');
            
            if (!tabIdInput) {
                // Create hidden input for tab ID
                tabIdInput = document.createElement('input');
                tabIdInput.type = 'hidden';
                tabIdInput.name = 'tabId';
                form.appendChild(tabIdInput);
            }
            
            // Always update the tab ID value
            tabIdInput.value = tabId;
        }, true); // Use capture phase to ensure this runs before other handlers
    }
    
    // Re-check for links to update periodically (in case they're added dynamically)
    setInterval(updateAllLinks, 2000);

})();