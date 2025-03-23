/**
 * CampusMatch - Advanced Match Interface for Tamkang University
 * Handles all interactive functionality for the matching page
 * Compatible with the MongoDB database structure
 */
document.addEventListener('DOMContentLoaded', function() {
    // DOM Element References
    const filterToggle = document.getElementById('filterToggle');
    const advancedFilters = document.getElementById('advancedFilters');
    const filterTabs = document.querySelectorAll('.filter-tab');
    const filterSections = document.querySelectorAll('.filter-section');
    const quickFilters = document.querySelectorAll('.quick-filter');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const resetSearchBtn = document.getElementById('resetSearchBtn');
    const sortSelect = document.getElementById('sortMatches');
    const matchesGrid = document.getElementById('matchesGrid');
    const viewToggleBtns = document.querySelectorAll('.toggle-btn');
    const swipeContainer = document.getElementById('swipeContainer');
    const cardActions = document.getElementById('cardActions');
    const refreshBtn = document.getElementById('refreshBtn');
    const saveButtons = document.querySelectorAll('.save-match-btn');
    const connectButtons = document.querySelectorAll('.connect-btn');
    const likeBtn = document.getElementById('likeBtn');
    const passBtn = document.getElementById('passBtn');
    const toastContainer = document.getElementById('toastContainer');
    
    // Track active filters count
    let activeFiltersCount = 0;
    
    // ========== Filter Functionality ==========
    
    // Expand/collapse advanced filters
    if (filterToggle && advancedFilters) {
        filterToggle.addEventListener('click', function() {
            const expanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', !expanded);
            
            if (expanded) {
                advancedFilters.classList.remove('expanded');
            } else {
                advancedFilters.classList.add('expanded');
                // Animate the expansion
                setTimeout(() => {
                    const firstInput = advancedFilters.querySelector('input, select');
                    if (firstInput) firstInput.focus();
                }, 300);
            }
        });
        
        // Check URL for active filters and expand if needed
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.toString() !== '') {
            advancedFilters.classList.add('expanded');
            filterToggle.setAttribute('aria-expanded', true);
        }
    }
    
    // Filter tabs switching
    if (filterTabs && filterTabs.length && filterSections && filterSections.length) {
        filterTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs and sections
                filterTabs.forEach(t => t.classList.remove('active'));
                filterSections.forEach(s => s.classList.remove('active'));
                
                // Add active class to current tab
                this.classList.add('active');
                
                // Show corresponding section
                const tabName = this.dataset.tab;
                const activeSection = document.querySelector(`.filter-section[data-section="${tabName}"]`);
                if (activeSection) {
                    activeSection.classList.add('active');
                    
                    // Focus first input in section for accessibility
                    setTimeout(() => {
                        const firstInput = activeSection.querySelector('input, select');
                        if (firstInput) firstInput.focus();
                    }, 100);
                }
            });
        });
    }
    
    // Quick filters selection
    if (quickFilters && quickFilters.length) {
        quickFilters.forEach(filter => {
            filter.addEventListener('click', function() {
                this.classList.toggle('active');
                updateActiveFiltersCount();
                updateActiveFiltersDisplay();
                
                // Animate badge
                const badge = this.querySelector('.badge');
                if (badge) {
                    badge.classList.add('pulse');
                    setTimeout(() => {
                        badge.classList.remove('pulse');
                    }, 500);
                }
            });
        });
    }
    
    // Update active filters count
    function updateActiveFiltersCount() {
        activeFiltersCount = document.querySelectorAll('.quick-filter.active').length;
        const filterCount = document.getElementById('filterCount');
        if (filterCount) filterCount.textContent = activeFiltersCount;
        
        // Update counter badge if exists
        const activeFilterCount = document.getElementById('activeFilterCount');
        if (activeFilterCount) {
            activeFilterCount.textContent = activeFiltersCount;
            if (activeFiltersCount > 0) {
                activeFilterCount.style.display = 'inline-flex';
            } else {
                activeFilterCount.style.display = 'none';
            }
        }
    }
    
    // Update active filters display
    function updateActiveFiltersDisplay() {
        const activeFilters = document.getElementById('activeFilters');
        const filterTags = document.getElementById('filterTags');
        
        if (!activeFilters || !filterTags) return;
        
        // Clear existing tags
        filterTags.innerHTML = '';
        
        // Add tag for each active filter
        document.querySelectorAll('.quick-filter.active').forEach(filter => {
            const tag = document.createElement('div');
            tag.className = 'filter-tag';
            tag.innerHTML = `
                ${filter.textContent.trim()}
                <i class='bx bx-x'></i>
            `;
            
            // Add click handler to remove tag
            tag.querySelector('i').addEventListener('click', () => {
                filter.classList.remove('active');
                updateActiveFiltersCount();
                updateActiveFiltersDisplay();
            });
            
            filterTags.appendChild(tag);
        });
        
        // Show/hide active filters container
        if (activeFiltersCount > 0) {
            activeFilters.style.display = 'flex';
        } else {
            activeFilters.style.display = 'none';
        }
    }
    
    // Clear all filters
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', function() {
            document.querySelectorAll('.quick-filter.active').forEach(filter => {
                filter.classList.remove('active');
            });
            updateActiveFiltersCount();
            updateActiveFiltersDisplay();
            
            // Show toast notification
            showToast('All filters cleared', 'info');
        });
    }
    
    // Reset search form
    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', function() {
            // Reset form inputs
            const form = this.closest('form');
            if (form) {
                form.reset();
                
                // Clear active quick filters
                document.querySelectorAll('.quick-filter.active').forEach(filter => {
                    filter.classList.remove('active');
                });
                updateActiveFiltersCount();
                updateActiveFiltersDisplay();
                
                // Show toast notification
                showToast('Search filters reset', 'info');
            }
        });
    }
    
    // ========== Match Grid Functionality ==========
    
    // Sort match cards
    if (sortSelect && matchesGrid) {
        sortSelect.addEventListener('change', function() {
            const sortValue = this.value;
            const cards = Array.from(document.querySelectorAll('.match-card'));
            
            if (!cards.length) return;
            
            // Sort cards based on selected option
            cards.sort((a, b) => {
                switch(sortValue) {
                    case 'match':
                        // Sort by match score (highest first)
                        return parseInt(b.dataset.matchScore || 0) - parseInt(a.dataset.matchScore || 0);
                    case 'name':
                        // Sort by name (A-Z)
                        const nameA = a.dataset.userName || a.querySelector('h3')?.textContent || '';
                        const nameB = b.dataset.userName || b.querySelector('h3')?.textContent || '';
                        return nameA.localeCompare(nameB);
                    case 'university':
                        // Sort by university
                        const uniA = a.dataset.university || a.querySelector('.match-detail-item span')?.textContent || '';
                        const uniB = b.dataset.university || b.querySelector('.match-detail-item span')?.textContent || '';
                        return uniA.localeCompare(uniB);
                    case 'recent':
                        // Sort by activity (most recent first)
                        const activityA = a.querySelector('.match-activity')?.textContent || '';
                        const activityB = b.querySelector('.match-activity')?.textContent || '';
                        if (activityA.includes('now') || activityB.includes('now')) {
                            return activityA.includes('now') ? -1 : 1;
                        }
                        return activityA.localeCompare(activityB);
                    default:
                        return 0;
                }
            });
            
            // Apply visual sorting animation
            cards.forEach((card, index) => {
                card.style.order = index;
                card.classList.add('sorting');
                setTimeout(() => {
                    card.classList.remove('sorting');
                }, 500);
            });
            
            // Show toast notification
            showToast(`Matches sorted by ${this.options[this.selectedIndex].text}`, 'info');
        });
    }
    
    // View toggle (Grid/Swipe)
    if (viewToggleBtns && viewToggleBtns.length) {
        viewToggleBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from all buttons
                viewToggleBtns.forEach(b => b.classList.remove('active'));
                // Add active class to current button
                this.classList.add('active');
                
                const viewType = this.dataset.view;
                
                if (viewType === 'grid') {
                    // Show grid view
                    if (matchesGrid) matchesGrid.style.display = 'grid';
                    if (swipeContainer) swipeContainer.style.display = 'none';
                    if (cardActions) cardActions.style.display = 'none';
                } else if (viewType === 'swipe') {
                    // Show swipe view
                    if (matchesGrid) matchesGrid.style.display = 'none';
                    if (swipeContainer) swipeContainer.style.display = 'block';
                    if (cardActions) cardActions.style.display = 'flex';
                    
                    // Initialize swipe cards
                    initSwipeCards();
                }
                
                // Save preference in localStorage
                localStorage.setItem('matchViewPreference', viewType);
            });
        });
        
        // Set initial view based on saved preference
        const savedView = localStorage.getItem('matchViewPreference');
        if (savedView === 'swipe') {
            const swipeBtn = document.querySelector('.toggle-btn[data-view="swipe"]');
            if (swipeBtn) swipeBtn.click();
        }
    }
    
    // ========== Interactive Features ==========
    
    // Animate match percentages
    function animateMatchPercentages() {
        const indicators = document.querySelectorAll('.match-percentage-indicator');
        
        indicators.forEach((indicator, index) => {
            const circle = indicator.querySelector('.score-circle-progress');
            const matchValue = indicator.querySelector('.match-value');
            
            if (circle && matchValue) {
                const score = parseInt(matchValue.textContent);
                const offset = 100 - score;
                
                // Reset circle first
                circle.style.strokeDashoffset = '100';
                
                // Animate with delay based on index
                setTimeout(() => {
                    circle.style.transition = 'stroke-dashoffset 1.5s ease';
                    circle.style.strokeDashoffset = offset;
                }, index * 100);
            }
        });
    }
    
    // Run match percentage animation on page load
    animateMatchPercentages();
    
    // Bookmark/Save match functionality
    if (saveButtons && saveButtons.length) {
        saveButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const saved = this.classList.contains('saved');
                
                if (saved) {
                    // Unsave
                    this.classList.remove('saved');
                    this.innerHTML = '<i class="bx bx-bookmark"></i>';
                    showToast('Match removed from favorites', 'info');
                } else {
                    // Save
                    this.classList.add('saved');
                    this.innerHTML = '<i class="bx bxs-bookmark"></i>';
                    showToast('Match added to favorites', 'success');
                    
                    // Create heart animation for visual feedback
                    createParticleEffect(this, 'heart');
                }
            });
        });
    }
    
    // Connect button functionality
    if (connectButtons && connectButtons.length) {
        connectButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                // If button is inside a form, prevent default submission
                if (this.closest('form')) {
                    e.preventDefault();
                }
                
                // Get user info for better feedback
                const card = this.closest('.match-card');
                const userName = card ? card.querySelector('h3').textContent : 'this user';
                
                // Get user ID from form action or data attribute
                const form = this.closest('.connect-form');
                const userId = form ? form.action.split('/').pop() : (card ? card.dataset.userId : null);
                
                if (!userId) {
                    showToast('Cannot identify user to connect with', 'error');
                    return;
                }
                
                // Disable button and show loading state
                this.disabled = true;
                const originalHTML = this.innerHTML;
                this.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Connecting...';
                
                // Send connection request to server using fetch API
                fetch(`/connect/${userId}`, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId: userId })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        // Success state
                        this.outerHTML = '<div class="connection-requested"><i class="bx bx-check"></i> Connection Requested</div>';
                        
                        // Show success toast
                        showToast(data.message || `Connection request sent to ${userName}!`, 'success');
                        
                        // Create animated heart particles
                        createParticleEffect(card, 'heart');
                    } else {
                        // Error handling
                        this.disabled = false;
                        this.innerHTML = originalHTML;
                        showToast(data.error || 'Failed to send connection request', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    this.disabled = false;
                    this.innerHTML = originalHTML;
                    showToast('Error sending connection request', 'error');
                });
            });
        });
    }
    
    // Refresh button animation
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            // Only process if not already refreshing
            if (this.classList.contains('refreshing')) return;
            
            // Add spinning animation
            this.classList.add('refreshing');
            
            // Show toast notification
            showToast('Refreshing your matches...', 'info');
            
            // Reanimate match percentages for visual feedback
            animateMatchPercentages();
            
            // Simulate refresh (replace with actual refresh logic)
            setTimeout(() => {
                // Remove spinning animation
                this.classList.remove('refreshing');
                
                // Show success toast
                showToast('Matches refreshed successfully!', 'success');
            }, 2000);
        });
    }
    
    // ========== Swipe Interface ==========
    
    function initSwipeCards() {
        if (!swipeContainer) return;
        
        // Clear existing cards
        swipeContainer.innerHTML = '';
        
        // Get data from match cards
        const matchCards = Array.from(document.querySelectorAll('.match-card'));
        if (!matchCards.length) return;
        
        // Create swipe cards
        matchCards.forEach((card, index) => {
            const img = card.querySelector('.match-photo img');
            const name = card.querySelector('h3').textContent;
            const details = card.querySelector('.match-details').textContent;
            const score = card.dataset.matchScore || '0';
            const userId = card.dataset.userId || (card.querySelector('a.view-profile-btn') 
                ? card.querySelector('a.view-profile-btn').href.split('/').pop() 
                : '');
            
            // Extract interests from different categories
            const interests = [];
            const interestTags = card.querySelectorAll('.interest-tag');
            if (interestTags.length) {
                Array.from(interestTags).slice(0, 3).forEach(tag => {
                    interests.push(tag.textContent.trim());
                });
            }
            
            const swipeCard = document.createElement('div');
            swipeCard.className = 'swipe-card';
            swipeCard.style.zIndex = matchCards.length - index;
            swipeCard.style.transform = index === 0 ? '' : `translateY(${index * 5}px) scale(${1 - (index * 0.02)})`;
            swipeCard.style.opacity = index === 0 ? '1' : `${1 - (index * 0.2)}`;
            swipeCard.dataset.userId = userId;
            
            swipeCard.innerHTML = `
                <img src="${img.src}" alt="${name}" class="card-photo">
                <div class="match-score">${score}% Match</div>
                <div class="like-indicator">LIKE</div>
                <div class="pass-indicator">PASS</div>
                <div class="card-info">
                    <h3 class="card-name">${name}</h3>
                    <p class="card-details">${details}</p>
                    <div class="card-interests">
                        ${interests.map(interest => `<span class="card-interest">${interest}</span>`).join('')}
                    </div>
                    <a href="/view-profile/${userId}" class="view-profile-btn">
                        <i class='bx bx-user'></i> View Full Profile
                    </a>
                </div>
            `;
            
            swipeContainer.appendChild(swipeCard);
        });
        
        // Add swipe functionality
        setupSwipeGestures();
    }
    
    function setupSwipeGestures() {
        const cards = document.querySelectorAll('.swipe-card');
        if (!cards.length) return;
        
        let currentCardIndex = 0;
        let isDragging = false;
        let startX = 0;
        let currentX = 0;
        
        // Get first (top) card
        const topCard = cards[0];
        if (!topCard) return;
        
        // Add event listeners for drag
        topCard.addEventListener('mousedown', startDrag);
        topCard.addEventListener('touchstart', startDrag, {passive: false});
        
        // Like button functionality
        if (likeBtn) {
            likeBtn.addEventListener('click', () => {
                if (currentCardIndex >= cards.length) return;
                
                const card = cards[currentCardIndex];
                card.querySelector('.like-indicator').style.opacity = '1';
                
                // Swipe animation
                card.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
                card.style.transform = 'translateX(150%) rotate(20deg)';
                card.style.opacity = '0';
                
                // Process like action
                setTimeout(() => {
                    processSwipeAction('like');
                }, 300);
            });
        }
        
        // Pass button functionality
        if (passBtn) {
            passBtn.addEventListener('click', () => {
                if (currentCardIndex >= cards.length) return;
                
                const card = cards[currentCardIndex];
                card.querySelector('.pass-indicator').style.opacity = '1';
                
                // Swipe animation
                card.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
                card.style.transform = 'translateX(-150%) rotate(-20deg)';
                card.style.opacity = '0';
                
                // Process pass action
                setTimeout(() => {
                    processSwipeAction('pass');
                }, 300);
            });
        }
        
        // Start drag
        function startDrag(e) {
            if (currentCardIndex >= cards.length) return;
            
            isDragging = true;
            
            // Get start position
            if (e.type === 'mousedown') {
                startX = e.clientX;
                document.addEventListener('mousemove', continueDrag);
                document.addEventListener('mouseup', endDrag);
            } else if (e.type === 'touchstart') {
                startX = e.touches[0].clientX;
                e.preventDefault();
                document.addEventListener('touchmove', continueDrag, {passive: false});
                document.addEventListener('touchend', endDrag);
            }
            
            // Remove any transition
            cards[currentCardIndex].style.transition = 'none';
            currentX = startX;
        }
        
        // Continue drag
        function continueDrag(e) {
            if (!isDragging || currentCardIndex >= cards.length) return;
            
            // Get current position
            if (e.type === 'mousemove') {
                currentX = e.clientX;
            } else if (e.type === 'touchmove') {
                currentX = e.touches[0].clientX;
                e.preventDefault();
            }
            
            // Calculate drag distance
            const deltaX = currentX - startX;
            
            // Move card
            const card = cards[currentCardIndex];
            card.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.05}deg)`;
            
            // Show like/pass indicators based on drag direction
            if (deltaX > 50) {
                card.querySelector('.like-indicator').style.opacity = Math.min(deltaX / 100, 1);
                card.querySelector('.pass-indicator').style.opacity = '0';
            } else if (deltaX < -50) {
                card.querySelector('.pass-indicator').style.opacity = Math.min(Math.abs(deltaX) / 100, 1);
                card.querySelector('.like-indicator').style.opacity = '0';
            } else {
                card.querySelector('.like-indicator').style.opacity = '0';
                card.querySelector('.pass-indicator').style.opacity = '0';
            }
        }
        
        // End drag
        function endDrag() {
            if (!isDragging || currentCardIndex >= cards.length) return;
            
            isDragging = false;
            
            // Remove move event listeners
            document.removeEventListener('mousemove', continueDrag);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchmove', continueDrag);
            document.removeEventListener('touchend', endDrag);
            
            // Calculate final swipe distance
            const deltaX = currentX - startX;
            const card = cards[currentCardIndex];
            
            // Add transition for smooth animation
            card.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
            
            // Determine if swipe was strong enough
            if (deltaX > 100) {
                // Swipe right - Like
                card.style.transform = 'translateX(150%) rotate(20deg)';
                card.style.opacity = '0';
                
                setTimeout(() => {
                    processSwipeAction('like');
                }, 300);
            } else if (deltaX < -100) {
                // Swipe left - Pass
                card.style.transform = 'translateX(-150%) rotate(-20deg)';
                card.style.opacity = '0';
                
                setTimeout(() => {
                    processSwipeAction('pass');
                }, 300);
            } else {
                // Return to center
                card.style.transform = '';
                card.querySelector('.like-indicator').style.opacity = '0';
                card.querySelector('.pass-indicator').style.opacity = '0';
            }
        }
        
        // Process swipe action
        function processSwipeAction(action) {
            if (currentCardIndex >= cards.length) return;
            
            const card = cards[currentCardIndex];
            const userId = card.dataset.userId;
            
            // Process the action
            if (action === 'like' && userId) {
                // Send connection request to the server for "liked" profiles
                fetch(`/connect/${userId}`, {
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
                        showToast(data.message || 'Connection request sent!', 'success');
                    } else {
                        showToast(data.error || 'Already connected with this user', 'info');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showToast('Profile liked', 'success');
                });
            } else {
                showToast('Profile skipped', 'info');
            }
            
            // Move to next card
            currentCardIndex++;
            
            // Check if there are more cards
            if (currentCardIndex < cards.length) {
                // Update card positions
                cards.forEach((card, index) => {
                    if (index < currentCardIndex) {
                        card.style.display = 'none';
                    } else if (index === currentCardIndex) {
                        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                        card.style.transform = '';
                        card.style.opacity = '1';
                        card.style.zIndex = cards.length;
                        
                        // Add new event listeners to current card
                        card.addEventListener('mousedown', startDrag);
                        card.addEventListener('touchstart', startDrag, {passive: false});
                    } else {
                        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                        card.style.transform = `translateY(${(index - currentCardIndex) * 5}px) scale(${1 - ((index - currentCardIndex) * 0.02)})`;
                        card.style.opacity = `${1 - ((index - currentCardIndex) * 0.2)}`;
                        card.style.zIndex = cards.length - (index - currentCardIndex);
                    }
                });
            } else {
                // No more cards
                showToast('You\'ve viewed all potential matches!', 'info');
                
                // Hide swipe buttons
                if (cardActions) cardActions.style.display = 'none';
                
                // Show empty state or reload
                const emptyState = document.createElement('div');
                emptyState.className = 'no-more-matches';
                emptyState.innerHTML = `
                    <i class='bx bx-check-double'></i>
                    <h3>You've seen all matches</h3>
                    <p>Check back later or try different filters</p>
                    <button id="resetSwipeBtn" class="action-button reset">Start Over</button>
                `;
                swipeContainer.appendChild(emptyState);
                
                // Add reset button functionality
                const resetBtn = document.getElementById('resetSwipeBtn');
                if (resetBtn) {
                    resetBtn.addEventListener('click', () => {
                        // Reinitialize swipe cards
                        initSwipeCards();
                        // Show swipe buttons
                        if (cardActions) cardActions.style.display = 'flex';
                    });
                }
            }
        }
    }
    
    // ========== Helper Functions ==========
    
    // Show toast notification
    function showToast(message, type = 'info') {
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Set icon based on type
        let iconClass = 'bx-info-circle';
        if (type === 'success') iconClass = 'bx-check-circle';
        if (type === 'error') iconClass = 'bx-error-circle';
        
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
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
    
    // Create particle effect (hearts, etc.)
    function createParticleEffect(element, type = 'heart') {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Create particles
        for (let i = 0; i < 7; i++) {
            const particle = document.createElement('i');
            
            if (type === 'heart') {
                particle.className = 'bx bxs-heart heart-particle';
                particle.style.color = getRandomColor(['#EC4899', '#DB2777', '#FF6B6B', '#FF8E8E']);
            } else {
                particle.className = 'bx bx-star heart-particle';
                particle.style.color = getRandomColor(['#FFD700', '#FFA500', '#FF8C00']);
            }
            
            // Random positioning
            particle.style.left = `${centerX}px`;
            particle.style.top = `${centerY}px`;
            particle.style.fontSize = `${12 + Math.random() * 10}px`;
            
            // Random animation delay
            particle.style.animationDelay = `${Math.random() * 0.3}s`;
            
            // Random direction
            const angle = Math.random() * Math.PI * 2; // Random angle
            const transformX = Math.cos(angle) * 20;
            const transformY = Math.sin(angle) * 20;
            particle.style.transform = `translate(${transformX}px, ${transformY}px)`;
            
            // Add to body
            document.body.appendChild(particle);
            
            // Remove after animation completes
            setTimeout(() => {
                particle.remove();
            }, 1000);
        }
    }
    
    // Get random color from array
    function getRandomColor(colors) {
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Initialize UI state
    updateActiveFiltersCount();
    updateActiveFiltersDisplay();
    
    // Check URL parameters for filter values and apply them
    function applyUrlFilters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Apply to quick filters
        const quickFilterMap = {
            'university': 'same-university',
            'major': 'same-major',
            'matchScore': 'high-match'
        };
        
        // Check URL params and activate corresponding quick filters
        Object.entries(quickFilterMap).forEach(([param, filterName]) => {
            if (urlParams.has(param) && urlParams.get(param) !== '') {
                const filter = document.querySelector(`.quick-filter[data-filter="${filterName}"]`);
                if (filter && !filter.classList.contains('active')) {
                    filter.classList.add('active');
                }
            }
        });
        
        // Update counts and display
        updateActiveFiltersCount();
        updateActiveFiltersDisplay();
    }
    
    // Apply filters from URL on page load
    applyUrlFilters();
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        .badge.pulse {
            animation: pulse 0.5s ease;
        }
        
        .match-card.sorting {
            transition: all 0.3s ease;
        }
        
        .heart-particle {
            position: absolute;
            font-size: 16px;
            pointer-events: none;
            z-index: 9999;
            animation: flyUpFade 1s ease-out forwards;
        }
        
        @keyframes flyUpFade {
            0% {
                transform: translateY(0) scale(0.5);
                opacity: 0;
            }
            20% {
                opacity: 1;
                transform: translateY(-20px) scale(1);
            }
            100% {
                transform: translateY(-100px) scale(0.5) rotate(20deg);
                opacity: 0;
            }
        }
        
        .toast {
            display: flex;
            align-items: center;
            padding: 1rem 1.5rem;
            background: var(--white);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            color: var(--text);
            transform: translateX(100%);
            opacity: 0;
            transition: transform 0.3s ease, opacity 0.3s ease;
            pointer-events: auto;
            max-width: 350px;
            margin-bottom: 0.75rem;
        }
        
        .toast.show {
            transform: translateX(0);
            opacity: 1;
        }
        
        .toast i {
            font-size: 1.25rem;
            margin-right: 0.75rem;
        }
        
        .toast-success {
            border-left: 4px solid var(--success);
        }
        
        .toast-success i {
            color: var(--success);
        }
        
        .toast-error {
            border-left: 4px solid var(--error);
        }
        
        .toast-error i {
            color: var(--error);
        }
        
        .toast-info {
            border-left: 4px solid var(--primary);
        }
        
        .toast-info i {
            color: var(--primary);
        }
        
        .close-toast {
            margin-left: auto;
            background: none;
            border: none;
            color: var(--text-light);
            cursor: pointer;
            font-size: 1rem;
        }
        
        .swipe-card .like-indicator,
        .swipe-card .pass-indicator {
            position: absolute;
            top: 35%;
            transform: translateY(-50%);
            font-size: 2rem;
            font-weight: 800;
            padding: 0.5rem 1.5rem;
            border: 4px solid;
            border-radius: var(--radius-md);
            opacity: 0;
            z-index: 10;
            pointer-events: none;
        }
        
        .swipe-card .like-indicator {
            right: 10%;
            color: var(--success);
            transform: translateY(-50%) rotate(15deg);
            border-color: var(--success);
        }
        
        .swipe-card .pass-indicator {
            left: 10%;
            color: var(--error);
            transform: translateY(-50%) rotate(-15deg);
            border-color: var(--error);
        }
        
        .card-actions {
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 2rem;
            z-index: 10;
        }
        
        .action-button {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            cursor: pointer;
            box-shadow: var(--shadow-md);
            transition: all 0.3s ease;
        }
        
        .action-button:active {
            transform: scale(0.9);
        }
        
        .action-button.pass {
            background: var(--white);
            color: var(--error);
            border: 2px solid var(--error);
        }
        
        .action-button.pass:hover {
            background: var(--error);
            color: var(--white);
            transform: translateY(-5px) rotate(-15deg);
        }
        
        .action-button.like {
            background: var(--primary);
            color: var(--white);
        }
        
        .action-button.like:hover {
            background: var(--success);
            transform: translateY(-5px) rotate(15deg);
        }
        
        .action-button.reset {
            background: var(--primary);
            color: var(--white);
            width: auto;
            height: auto;
            border-radius: var(--radius-md);
            padding: 0.75rem 1.5rem;
        }
        
        .no-more-matches {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: var(--white);
            border-radius: var(--radius-lg);
            padding: 2rem;
            text-align: center;
            gap: 1rem;
        }
        
        .no-more-matches i {
            font-size: 3rem;
            color: var(--primary);
        }
    `;
    document.head.appendChild(style);
});