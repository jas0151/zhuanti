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
    const refreshBtn = document.getElementById('refreshBtn');
    const saveButtons = document.querySelectorAll('.save-match-btn');
    const connectButtons = document.querySelectorAll('.connect-btn');
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
    
    // Simplified view toggle - Grid view only
    if (viewToggleBtns && viewToggleBtns.length) {
        viewToggleBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from all buttons
                viewToggleBtns.forEach(b => b.classList.remove('active'));
                // Add active class to current button
                this.classList.add('active');
                
                // Always show grid view
                if (matchesGrid) matchesGrid.style.display = 'grid';
            });
        });
        
        // Always set grid view as active
        const gridBtn = document.querySelector('.toggle-btn[data-view="grid"]');
        if (gridBtn) {
            gridBtn.classList.add('active');
        }
        
        // Set grid view as visible
        if (matchesGrid) matchesGrid.style.display = 'grid';
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