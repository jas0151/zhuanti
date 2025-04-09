// session-validator.js - Validates and manages tab-specific sessions
(function() {
    // Skip this if we're on the login or signup page
    if (window.location.pathname === '/login' || window.location.pathname === '/signup') {
        return;
    }
    
    // Get the tab ID from URL, sessionStorage, or data attribute
    const tabId = getTabId();
    
    // Get current user ID from the data attribute
    const currentUserId = document.body.dataset.userId;
    const currentUserName = document.body.dataset.userName;
    
    // Skip if no user ID (not logged in)
    if (!currentUserId) {
        console.log('No user ID found, skipping session validation');
        return;
    }
    
    console.log(`Session validator initialized for user ${currentUserId} in tab ${tabId}`);
    
    // Store user ID in sessionStorage for this tab
    sessionStorage.setItem('campusmatch_tab_id', tabId);
    sessionStorage.setItem('campusmatch_user_id', currentUserId);
    
    // Do an initial session validation
    validateSession();
    
    // Set up periodic session validation
    setInterval(validateSession, 2 * 60 * 1000); // Every 2 minutes
    
    // Add event listener for storage events to detect changes in other tabs
    window.addEventListener('storage', handleStorageChange);
    
    // Functions
    
    // Get tab ID from various sources
    function getTabId() {
        // Check URL first
        const url = new URL(window.location.href);
        const urlTabId = url.searchParams.get('tabId');
        
        // Then check sessionStorage
        const sessionTabId = sessionStorage.getItem('campusmatch_tab_id');
        
        // Then check data attribute
        const domTabId = document.body.dataset.tabId;
        
        // Return existing or generate new
        return urlTabId || sessionTabId || domTabId || (Date.now() + '-' + Math.random().toString(36).substring(2, 15));
    }
    
    // Validate the current session
    function validateSession() {
        // Get our stored user ID
        const storedUserId = sessionStorage.getItem('campusmatch_user_id');
        
        // If no stored ID or it doesn't match the DOM, update storage
        if (!storedUserId || storedUserId !== currentUserId) {
            console.log(`Updating stored user ID from ${storedUserId} to ${currentUserId}`);
            sessionStorage.setItem('campusmatch_user_id', currentUserId);
        }
        
        // Check with the server
        fetch(`/api/session-check?tabId=${tabId}`)
            .then(response => response.json())
            .then(data => {
                if (!data.authenticated) {
                    console.warn('Session expired or not authenticated');
                    // Redirect to login with tab ID
                    window.location.href = `/login?session=expired&tabId=${tabId}`;
                    return;
                }
                
                // Make sure the server's userId matches what we expect for this tab
                if (data.userId !== currentUserId) {
                    console.warn('Session user ID mismatch - Expected:', currentUserId, 'Server:', data.userId);
                    
                    // Ask user what to do
                    const message = `There appears to be a session conflict. Do you want to reload the page to continue as ${data.userName || 'the current user'}?`;
                    
                    if (confirm(message)) {
                        // Reload to get the updated session
                        window.location.reload();
                    } else {
                        // User wants to stay as they are - go to login
                        window.location.href = `/login?session=conflict&tabId=${tabId}`;
                    }
                }
            })
            .catch(error => {
                console.error('Error checking session:', error);
                // Don't redirect on network errors to avoid logout loops
            });
    }
    
    // Handle storage events from other tabs
    function handleStorageChange(e) {
        // Skip if this event doesn't concern us
        if (!e.key || !e.key.startsWith('campusmatch_')) {
            return;
        }
        
        console.log(`Storage changed: ${e.key} from "${e.oldValue}" to "${e.newValue}"`);
        
        // Handle global user changes (from other tabs)
        if (e.key === 'campusmatch_global_user' && e.newValue !== currentUserId) {
            console.warn('User change detected in another tab');
            
            // Only ask if the user actually changed
            if (e.newValue && e.newValue !== currentUserId) {
                if (confirm('You have logged in as a different user in another tab. Would you like to reload this page with the new user?')) {
                    window.location.reload();
                }
            }
        }
    }
    
    // Store current user ID in localStorage for cross-tab awareness
    // Use a different key than the tab-specific one
    localStorage.setItem('campusmatch_global_user', currentUserId);
    
    // When the page unloads, don't clean up so sessions persist across refreshes
})();