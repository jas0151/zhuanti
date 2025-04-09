/**
 * CampusMatch - Connections Page JavaScript
 * Handles all interactive functionality for the connections page
 */
document.addEventListener('DOMContentLoaded', function() {
    // DOM Element References
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const acceptForms = document.querySelectorAll('.accept-form');
    const rejectForms = document.querySelectorAll('.reject-form');
    const cancelRequestBtns = document.querySelectorAll('.cancel-request-btn');
    const removeConnectionBtns = document.querySelectorAll('.remove-connection-btn');
    const searchInput = document.getElementById('searchConnections');
    const toastContainer = document.getElementById('toastContainer');
    
    // Initialize tabs
    if (tabButtons && tabButtons.length) {
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.style.display = 'none');
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Show corresponding content
                const tabId = this.getAttribute('data-tab');
                document.getElementById(`${tabId}-tab`).style.display = 'block';
                
                // Save active tab preference
                localStorage.setItem('activeConnectionTab', tabId);
            });
        });
        
        // Set active tab based on saved preference
        const savedTab = localStorage.getItem('activeConnectionTab');
        if (savedTab) {
            const tabToActivate = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
            if (tabToActivate) tabToActivate.click();
        }
    }
    
    // Handle connection acceptance with AJAX
    if (acceptForms && acceptForms.length) {
        acceptForms.forEach(form => {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Show loading state
                const card = this.closest('.connection-card');
                const cardContent = card.innerHTML;
                
                // Replace with loading state
                card.innerHTML = `
                    <div class="connection-loading">
                        <div class="loading-spinner">
                            <i class='bx bx-loader-alt bx-spin'></i>
                        </div>
                        <p>Accepting connection...</p>
                    </div>
                `;
                
                // Get user ID from form action
                const userId = this.action.split('/').pop();
                
                // Send acceptance request
                fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        // Show success animation
                        card.innerHTML = `
                            <div class="connection-success">
                                <div class="success-icon">
                                    <i class='bx bx-check-circle'></i>
                                </div>
                                <p>Connection accepted!</p>
                                <p class="redirect-message">Opening chat...</p>
                            </div>
                        `;
                        
                        // Add visual success effect to the card
                        card.classList.add('success-animation');
                        
                        // Update badge counters
                        updateBadgeCounts('pending', -1);
                        updateBadgeCounts('accepted', 1);
                        
                        // Show toast notification
                        showToast('Connection accepted!', 'success');
                        
                        // Redirect to chat after a short delay
                        setTimeout(() => {
                            window.location.href = `/chat/${userId}`;
                        }, 1500);
                    } else {
                        // Restore original content on error
                        card.innerHTML = cardContent;
                        showToast(data.error || 'Failed to accept connection', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    
                    // Restore original content on error
                    card.innerHTML = cardContent;
                    showToast('Network error. Please try again.', 'error');
                });
            });
        });
    }
    
    // Handle connection rejection with AJAX and reason dialog
    if (rejectForms && rejectForms.length) {
        rejectForms.forEach(form => {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Show reason dialog
                showReasonDialog(this.action);
            });
        });
    }
    // Add this to the end of your connection.js file

// Initialize chat buttons functionality
function initializeChatButtons() {
    const chatButtons = document.querySelectorAll('.chat-btn');
    
    if (chatButtons && chatButtons.length) {
        chatButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Get user ID from data attribute
                const userId = this.getAttribute('data-user-id');
                if (!userId) return;
                
                // Show loading state
                const originalText = this.innerHTML;
                this.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i>';
                this.disabled = true;
                
                // Redirect to chat page
                window.location.href = `/chat/${userId}`;
            });
        });
    }
}

// Call this function when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // ... (existing code)
    
    // Initialize chat buttons
    initializeChatButtons();
});
    // Show rejection reason dialog
    function showReasonDialog(formAction) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        // Create modal content
        overlay.innerHTML = `
            <div class="modal-content">
                <h3>Decline Connection Request</h3>
                <p>Please select a reason for declining this connection:</p>
                
                <form id="rejectionReasonForm" action="${formAction}" method="POST">
                    <div class="rejection-reasons">
                        <label class="reason-option">
                            <input type="radio" name="reason" value="not_interested" checked>
                            <span>Not interested in connecting</span>
                        </label>
                        <label class="reason-option">
                            <input type="radio" name="reason" value="dont_know">
                            <span>Don't know this person</span>
                        </label>
                        <label class="reason-option">
                            <input type="radio" name="reason" value="incompatible">
                            <span>Not compatible with my interests</span>
                        </label>
                        <label class="reason-option">
                            <input type="radio" name="reason" value="spam">
                            <span>Seems like spam/fake profile</span>
                        </label>
                        <label class="reason-option">
                            <input type="radio" name="reason" value="other">
                            <span>Other reason</span>
                        </label>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="cancel-btn" id="cancelRejectBtn">Cancel</button>
                        <button type="submit" class="reject-btn">Confirm Rejection</button>
                    </div>
                </form>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(overlay);
        
        // Handle cancel button
        overlay.querySelector('#cancelRejectBtn').addEventListener('click', function() {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 300);
        });
        
        // Handle form submission
        overlay.querySelector('#rejectionReasonForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(this);
            const reason = formData.get('reason');
            
            // Get user ID
            const userId = this.action.split('/').pop();
            
            // Get card reference
            const card = document.querySelector(`.connection-card[data-user-id="${userId}"]`);
            
            // Show loading state in modal
            this.innerHTML = `
                <div class="modal-loading">
                    <i class='bx bx-loader-alt bx-spin'></i>
                    <p>Processing rejection...</p>
                </div>
            `;
            
            // Send rejection request
            fetch(this.action, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Remove modal with animation
                    overlay.classList.add('fade-out');
                    setTimeout(() => overlay.remove(), 300);
                    
                    // Update the UI - animate card removal
                    if (card) {
                        card.classList.add('fade-out');
                        setTimeout(() => {
                            card.remove();
                            
                            // Check if no more cards
                            const pendingTab = document.getElementById('pending-tab');
                            const remainingCards = pendingTab.querySelectorAll('.connection-card');
                            
                            if (remainingCards.length === 0) {
                                pendingTab.innerHTML = `
                                    <div class="empty-state">
                                        <i class='bx bx-time-five'></i>
                                        <p>You don't have any pending connection requests.</p>
                                    </div>
                                `;
                            }
                            
                            // Update badge counter
                            updateBadgeCounts('pending', -1);
                        }, 300);
                    }
                    
                    // Show toast notification
                    showToast('Connection request rejected', 'info');
                } else {
                    // Remove modal
                    overlay.remove();
                    
                    // Show error toast
                    showToast(data.error || 'Failed to reject connection', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                overlay.remove();
                showToast('Network error. Please try again.', 'error');
            });
        });
        
        // Animate modal in
        setTimeout(() => overlay.classList.add('show'), 10);
    }
    
    // Handle canceling sent requests
    if (cancelRequestBtns && cancelRequestBtns.length) {
        cancelRequestBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Get user ID from data attribute
                const userId = this.getAttribute('data-user-id');
                if (!userId) return;
                
                // Confirm action
                if (!confirm('Are you sure you want to cancel this connection request?')) {
                    return;
                }
                
                // Get card reference
                const card = this.closest('.connection-card');
                
                // Disable button and show loading
                this.disabled = true;
                this.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i>';
                
                // Send cancel request
                fetch(`/cancel-request/${userId}`, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Animate card removal
                        card.classList.add('fade-out');
                        setTimeout(() => {
                            card.remove();
                            
                            // Check if no more cards
                            const sentTab = document.getElementById('sent-tab');
                            const remainingCards = sentTab.querySelectorAll('.connection-card');
                            
                            if (remainingCards.length === 0) {
                                sentTab.innerHTML = `
                                    <div class="empty-state">
                                        <i class='bx bx-send'></i>
                                        <p>You haven't sent any connection requests yet.</p>
                                        <a href="/matches" class="empty-action-btn">Find Matches</a>
                                    </div>
                                `;
                            }
                            
                            // Update badge counter
                            updateBadgeCounts('sent', -1);
                        }, 300);
                        
                        // Show toast notification
                        showToast('Connection request canceled', 'info');
                    } else {
                        // Re-enable button
                        this.disabled = false;
                        this.innerHTML = 'Cancel Request';
                        
                        // Show error toast
                        showToast(data.error || 'Failed to cancel request', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    
                    // Re-enable button
                    this.disabled = false;
                    this.innerHTML = 'Cancel Request';
                    
                    // Show error toast
                    showToast('Network error. Please try again.', 'error');
                });
            });
        });
    }
    
    // Handle removing connections
    if (removeConnectionBtns && removeConnectionBtns.length) {
        removeConnectionBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Get user ID from data attribute
                const userId = this.getAttribute('data-user-id');
                if (!userId) return;
                
                // Confirm action
                if (!confirm('Are you sure you want to remove this connection? You will no longer be able to message each other.')) {
                    return;
                }
                
                // Get card reference
                const card = this.closest('.connection-card');
                
                // Disable button and show loading
                this.disabled = true;
                this.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i>';
                
                // Send remove request
                fetch(`/remove-connection/${userId}`, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Animate card removal
                        card.classList.add('fade-out');
                        setTimeout(() => {
                            card.remove();
                            
                            // Check if no more cards
                            const acceptedTab = document.getElementById('accepted-tab');
                            const remainingCards = acceptedTab.querySelectorAll('.connection-card');
                            
                            if (remainingCards.length === 0) {
                                acceptedTab.innerHTML = `
                                    <div class="empty-state">
                                        <i class='bx bx-user-check'></i>
                                        <p>You don't have any active connections yet.</p>
                                        <a href="/matches" class="empty-action-btn">Find Matches</a>
                                    </div>
                                `;
                            }
                            
                            // Update badge counter
                            updateBadgeCounts('accepted', -1);
                        }, 300);
                        
                        // Show toast notification
                        showToast('Connection removed', 'info');
                    } else {
                        // Re-enable button
                        this.disabled = false;
                        this.innerHTML = 'Remove';
                        
                        // Show error toast
                        showToast(data.error || 'Failed to remove connection', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    
                    // Re-enable button
                    this.disabled = false;
                    this.innerHTML = 'Remove';
                    
                    // Show error toast
                    showToast('Network error. Please try again.', 'error');
                });
            });
        });
    }
    
    // Connection Search Functionality
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            const searchValue = this.value.toLowerCase().trim();
            
            // Find all connection cards in all tabs
            const allCards = document.querySelectorAll('.connection-card');
            
            allCards.forEach(card => {
                const name = card.querySelector('h3').textContent.toLowerCase();
                const details = card.querySelector('.connection-detail').textContent.toLowerCase();
                
                // Show/hide based on search
                if (name.includes(searchValue) || details.includes(searchValue)) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
            
            // Check if no visible cards in active tab
            const activeTab = document.querySelector('.tab-content[style="display: block;"]');
            if (activeTab) {
                const visibleCards = activeTab.querySelectorAll('.connection-card[style="display: "";"]');
                
                if (visibleCards.length === 0) {
                    // Check if empty state already exists
                    if (!activeTab.querySelector('.search-empty-state')) {
                        const emptyState = document.createElement('div');
                        emptyState.className = 'search-empty-state';
                        emptyState.innerHTML = `
                            <i class='bx bx-search'></i>
                            <p>No matches found for "${searchValue}"</p>
                            <button class="clear-search-btn">Clear Search</button>
                        `;
                        
                        // Add clear button functionality
                        emptyState.querySelector('.clear-search-btn').addEventListener('click', function() {
                            searchInput.value = '';
                            searchInput.dispatchEvent(new Event('input'));
                        });
                        
                        activeTab.appendChild(emptyState);
                    }
                } else {
                    // Remove empty state if it exists
                    const emptyState = activeTab.querySelector('.search-empty-state');
                    if (emptyState) emptyState.remove();
                }
            }
        }, 300));
    }
    
    // Helper function to update badge counts
    function updateBadgeCounts(tabName, change) {
        const tab = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        let badge = tab.querySelector('.badge');
        
        if (badge) {
            const currentCount = parseInt(badge.textContent);
            const newCount = currentCount + change;
            
            if (newCount <= 0) {
                badge.remove();
            } else {
                badge.textContent = newCount;
            }
        } else if (change > 0) {
            // Create new badge if needed
            const newBadge = document.createElement('span');
            newBadge.className = 'badge';
            newBadge.textContent = change;
            tab.appendChild(newBadge);
        }
    }
    
    // Helper function to show toast notifications
    function showToast(message, type = 'info') {
        if (!toastContainer) {
            // Create toast container if it doesn't exist
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
            toastContainer = container;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Set icon based on type
        let iconClass = 'bx-info-circle';
        if (type === 'success') iconClass = 'bx-check-circle';
        if (type === 'error') iconClass = 'bx-error-circle';
        if (type === 'warning') iconClass = 'bx-error';
        
        toast.innerHTML = `
            <i class='bx ${iconClass}'></i>
            <div class="toast-content">
                <p>${message}</p>
            </div>
            <button class="close-toast">
                <i class='bx bx-x'></i>
            </button>
        `;
        
        // Add close button functionality
        const closeBtn = toast.querySelector('.close-toast');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            });
        }
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Force reflow for animation
        void toast.offsetWidth;
        
        // Show toast
        toast.classList.add('show');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
    }
    
    // Debounce helper function to limit rapid function calls
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
    
    // Add CSS for modal and animations
    const style = document.createElement('style');
    style.textContent = `
        /* Modal overlay */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        
        .modal-overlay.show {
            opacity: 1;
            visibility: visible;
        }
        
        .modal-overlay.fade-out {
            opacity: 0;
            visibility: hidden;
        }
        
        .modal-content {
            background-color: white;
            border-radius: 0.75rem;
            padding: 1.5rem;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transform: scale(0.9);
            transition: transform 0.3s ease;
        }
        
        .modal-overlay.show .modal-content {
            transform: scale(1);
        }
        
        .modal-content h3 {
            margin-top: 0;
            margin-bottom: 1rem;
            color: #4b5563;
        }
        
        .rejection-reasons {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
        }
        
        .reason-option {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            cursor: pointer;
        }
        
        .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
        }
        
        .cancel-btn {
            padding: 0.5rem 1rem;
            background-color: transparent;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 0.875rem;
            transition: background-color 0.2s ease;
        }
        
        .cancel-btn:hover {
            background-color: #f3f4f6;
        }
        
        .reject-btn {
            padding: 0.5rem 1rem;
            background-color: #ef4444;
            color: white;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 0.875rem;
            transition: background-color 0.2s ease;
        }
        
        .reject-btn:hover {
            background-color: #dc2626;
        }
        
        .modal-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            padding: 2rem;
        }
        
        .modal-loading i {
            font-size: 2rem;
            color: #8b5cf6;
        }
        
        /* Card animations */
        .connection-card {
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        
        .connection-card.fade-out {
            opacity: 0;
            transform: translateY(20px);
        }
        
        .connection-loading,
        .connection-success {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            text-align: center;
            height: 100%;
        }
        
        .loading-spinner {
            font-size: 2.5rem;
            color: #8b5cf6;
            margin-bottom: 1rem;
        }
        
        .success-icon {
            font-size: 3rem;
            color: #10b981;
            margin-bottom: 1rem;
            animation: success-pulse 1.5s ease infinite;
        }
        
        @keyframes success-pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        .success-animation {
            transform: scale(1.05);
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
            transition: all 0.5s ease;
        }
        
        .redirect-message {
            margin-top: 1rem;
            color: #6b7280;
            font-size: 0.875rem;
        }
        
        /* Empty search state */
        .search-empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
            text-align: center;
        }
        
        .search-empty-state i {
            font-size: 2rem;
            color: #9ca3af;
            margin-bottom: 1rem;
        }
        
        .clear-search-btn {
            margin-top: 1rem;
            padding: 0.5rem 1rem;
            background-color: #8b5cf6;
            color: white;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 0.875rem;
            transition: background-color 0.2s ease;
        }
        
        .clear-search-btn:hover {
            background-color: #7c3aed;
        }
    `;
    document.head.appendChild(style);
});