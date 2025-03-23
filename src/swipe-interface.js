// Improved Mobile Swipe Interface for Matches
document.addEventListener('DOMContentLoaded', function() {
    // Check if we should initialize the swipe interface (on mobile devices)
    const isMobile = window.innerWidth <= 768;
    const matchesGrid = document.querySelector('.matches-grid');
    
    if (matchesGrid && matchesGrid.children.length > 0) {
        // Add toggle button if it doesn't exist
        if (!document.querySelector('.view-toggle')) {
            addViewToggle();
        }
        
        // Create swipe container if it doesn't exist
        if (!document.querySelector('.swipe-container')) {
            createSwipeContainer();
        }

        // Initialize the toggle behavior
        initializeToggleBehavior();
    }

    function addViewToggle() {
        const viewToggle = document.createElement('div');
        viewToggle.className = 'view-toggle';
        viewToggle.innerHTML = `
            <button class="toggle-btn active" data-view="grid">
                <i class='bx bx-grid-alt'></i> Grid
            </button>
            <button class="toggle-btn" data-view="swipe">
                <i class='bx bx-slider'></i> Swipe
            </button>
        `;
        
        // Insert toggle before the matches grid
        matchesGrid.parentNode.insertBefore(viewToggle, matchesGrid);
    }

    function createSwipeContainer() {
        const swipeContainer = document.createElement('div');
        swipeContainer.className = 'swipe-container';
        swipeContainer.style.display = 'none';

        // Create cards
        createSwipeCards(swipeContainer);
        
        // Add "no more matches" placeholder
        addNoMoreMatchesPlaceholder(swipeContainer);
        
        // Add swipe action buttons
        addActionButtons();
        
        // Insert swipe container after matches grid
        matchesGrid.parentNode.insertBefore(swipeContainer, matchesGrid.nextSibling);
    }

    function createSwipeCards(container) {
        const matchCards = Array.from(matchesGrid.querySelectorAll('.match-card'));
        
        matchCards.forEach((card, index) => {
            // Extract data safely
            const name = card.querySelector('h3')?.textContent || 'No Name';
            const detailsEl = card.querySelector('.match-details');
            const details = detailsEl?.innerHTML || '';
            const photoEl = card.querySelector('.match-photo img');
            const photoSrc = photoEl?.src || '/default-avatar.png';
            const matchScore = card.dataset.matchScore || '0';
            const linkEl = card.querySelector('a.view-profile-btn');
            const hrefParts = linkEl?.getAttribute('href')?.split('/') || [];
            const userId = hrefParts[hrefParts.length - 1] || '';
            
            // Create swipe card
            const swipeCard = document.createElement('div');
            swipeCard.className = 'swipe-card';
            swipeCard.style.zIndex = 1000 - index;
            swipeCard.style.transform = 'scale(0.95) translateY(10px)';
            swipeCard.style.opacity = index === 0 ? '1' : '0';
            swipeCard.dataset.index = index;
            swipeCard.dataset.userId = userId;
            
            swipeCard.innerHTML = `
                <img src="${photoSrc}" alt="${name}" class="card-photo">
                <div class="match-score">${matchScore}% Match</div>
                <div class="like-indicator">Like</div>
                <div class="pass-indicator">Pass</div>
                <div class="card-info">
                    <h2 class="card-name">${name}</h2>
                    <div class="card-details">${details}</div>
                </div>
            `;
            
            container.appendChild(swipeCard);
        });
    }

    function addNoMoreMatchesPlaceholder(container) {
        const noMoreMatches = document.createElement('div');
        noMoreMatches.className = 'no-more-matches';
        noMoreMatches.innerHTML = `
            <i class='bx bx-check-double'></i>
            <h3>You've seen all matches</h3>
            <p>Check back later for new potential connections</p>
            <button id="resetSwipeBtn">Start Over</button>
        `;
        
        container.appendChild(noMoreMatches);
    }

    function addActionButtons() {
        // Only add if they don't exist
        if (!document.querySelector('.card-actions')) {
            const cardActions = document.createElement('div');
            cardActions.className = 'card-actions';
            cardActions.style.display = 'none';
            cardActions.innerHTML = `
                <div class="action-button pass" id="passBtn">
                    <i class='bx bx-x'></i>
                </div>
                <div class="action-button like" id="likeBtn">
                    <i class='bx bx-heart'></i>
                </div>
            `;
            
            document.querySelector('.matches-container').appendChild(cardActions);
        }
    }

    function initializeToggleBehavior() {
        const viewToggleBtns = document.querySelectorAll('.toggle-btn');
        const swipeContainer = document.querySelector('.swipe-container');
        const cardActions = document.querySelector('.card-actions');
        
        viewToggleBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Update active button
                viewToggleBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                const view = this.getAttribute('data-view');
                
                if (view === 'grid') {
                    matchesGrid.style.display = '';
                    if (swipeContainer) swipeContainer.style.display = 'none';
                    if (cardActions) cardActions.style.display = 'none';
                } else {
                    matchesGrid.style.display = 'none';
                    if (swipeContainer) {
                        swipeContainer.style.display = 'block';
                        // Initialize swipe cards if they're not set up
                        if (!document.querySelector('.swipe-card.active')) {
                            initializeSwipeCards();
                        }
                    }
                    if (cardActions) cardActions.style.display = 'flex';
                }
                
                // Save preference
                localStorage.setItem('matchViewPreference', view);
            });
        });

        // Check for stored preference
        const savedView = localStorage.getItem('matchViewPreference');
        if (savedView === 'swipe' && isMobile) {
            const swipeBtn = document.querySelector('.toggle-btn[data-view="swipe"]');
            if (swipeBtn) swipeBtn.click();
        }
    }

    function initializeSwipeCards() {
        const swipeContainer = document.querySelector('.swipe-container');
        if (!swipeContainer) return;

        const cards = swipeContainer.querySelectorAll('.swipe-card');
        if (!cards.length) return;
        
        let currentCardIndex = 0;
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        const matchCards = Array.from(matchesGrid.querySelectorAll('.match-card'));

        // Set up the first card
        setupCurrentCard();
        
        // Add touch/mouse event listeners to cards
        cards.forEach(card => {
            card.addEventListener('touchstart', handleStart, { passive: false });
            card.addEventListener('touchmove', handleMove, { passive: false });
            card.addEventListener('touchend', handleEnd);
            
            card.addEventListener('mousedown', handleStart);
            card.addEventListener('mousemove', handleMove);
            card.addEventListener('mouseup', handleEnd);
            card.addEventListener('mouseleave', handleEnd);
        });
        
        // Button handlers
        const likeBtn = document.getElementById('likeBtn');
        const passBtn = document.getElementById('passBtn');
        
        if (likeBtn) {
            likeBtn.addEventListener('click', function() {
                if (currentCardIndex >= cards.length) return;
                
                const card = cards[currentCardIndex];
                if (!card) return;
                
                card.style.transition = 'transform 0.5s ease';
                card.style.transform = 'translateX(1000px) rotate(30deg)';
                const likeIndicator = card.querySelector('.like-indicator');
                if (likeIndicator) likeIndicator.style.opacity = 1;
                
                handleLike();
            });
        }
        
        if (passBtn) {
            passBtn.addEventListener('click', function() {
                if (currentCardIndex >= cards.length) return;
                
                const card = cards[currentCardIndex];
                if (!card) return;
                
                card.style.transition = 'transform 0.5s ease';
                card.style.transform = 'translateX(-1000px) rotate(-30deg)';
                const passIndicator = card.querySelector('.pass-indicator');
                if (passIndicator) passIndicator.style.opacity = 1;
                
                handlePass();
            });
        }
        
        // Reset button handler
        const resetSwipeBtn = document.getElementById('resetSwipeBtn');
        if (resetSwipeBtn) {
            resetSwipeBtn.addEventListener('click', function() {
                currentCardIndex = 0;
                setupCurrentCard();
            });
        }
        
        function setupCurrentCard() {
            if (currentCardIndex >= cards.length) {
                // Show "no more matches" state
                const noMoreMatches = document.querySelector('.no-more-matches');
                if (noMoreMatches) noMoreMatches.style.display = 'flex';
                if (cardActions) cardActions.style.display = 'none';
                return;
            } else {
                const noMoreMatches = document.querySelector('.no-more-matches');
                if (noMoreMatches) noMoreMatches.style.display = 'none';
                if (cardActions) cardActions.style.display = 'flex';
            }
            
            // Reset all cards
            cards.forEach(card => {
                card.style.transform = 'scale(0.95) translateY(10px)';
                card.style.opacity = '0';
                card.classList.remove('active');
                
                // Reset indicators
                const likeIndicator = card.querySelector('.like-indicator');
                const passIndicator = card.querySelector('.pass-indicator');
                if (likeIndicator) likeIndicator.style.opacity = '0';
                if (passIndicator) passIndicator.style.opacity = '0';
            });
            
            // Setup current card
            if (currentCardIndex < cards.length) {
                const currentCard = cards[currentCardIndex];
                currentCard.style.transform = 'scale(1) translateY(0)';
                currentCard.style.opacity = '1';
                currentCard.style.zIndex = '1000';
                currentCard.classList.add('active');
                
                // Setup next card if exists
                if (currentCardIndex + 1 < cards.length) {
                    const nextCard = cards[currentCardIndex + 1];
                    nextCard.style.transform = 'scale(0.95) translateY(10px)';
                    nextCard.style.opacity = '0.5';
                    nextCard.style.zIndex = '999';
                }
            }
        }
        
        function handleStart(e) {
            const activeCard = document.querySelector('.swipe-card.active');
            if (!activeCard || !e.target.closest('.swipe-card.active')) return;
            
            isDragging = true;
            
            if (e.type === 'mousedown') {
                startX = e.clientX;
            } else if (e.type === 'touchstart') {
                startX = e.touches[0].clientX;
                e.preventDefault(); // Prevent default to avoid scrolling while swiping
            }
            
            currentX = startX;
            activeCard.style.transition = 'none';
        }
        
        function handleMove(e) {
            if (!isDragging) return;
            
            if (e.type === 'mousemove') {
                currentX = e.clientX;
            } else if (e.type === 'touchmove') {
                currentX = e.touches[0].clientX;
                e.preventDefault(); // Prevent default to avoid scrolling while swiping
            }
            
            const diffX = currentX - startX;
            const activeCard = document.querySelector('.swipe-card.active');
            if (!activeCard) return;
            
            // Move card
            activeCard.style.transform = `translateX(${diffX}px) rotate(${diffX * 0.05}deg)`;
            
            // Update indicators
            const likeIndicator = activeCard.querySelector('.like-indicator');
            const passIndicator = activeCard.querySelector('.pass-indicator');
            
            if (diffX > 50 && likeIndicator) {
                likeIndicator.style.opacity = Math.min(diffX / 100, 1);
                if (passIndicator) passIndicator.style.opacity = 0;
            } else if (diffX < -50 && passIndicator) {
                passIndicator.style.opacity = Math.min(Math.abs(diffX) / 100, 1);
                if (likeIndicator) likeIndicator.style.opacity = 0;
            } else {
                if (likeIndicator) likeIndicator.style.opacity = 0;
                if (passIndicator) passIndicator.style.opacity = 0;
            }
        }
        
        function handleEnd(e) {
            if (!isDragging) return;
            isDragging = false;
            
            const diffX = currentX - startX;
            const activeCard = document.querySelector('.swipe-card.active');
            if (!activeCard) return;
            
            // Add transition for smooth animation
            activeCard.style.transition = 'transform 0.5s ease';
            
            // Determine if swipe was strong enough
            if (diffX > 100) {
                // Like
                activeCard.style.transform = 'translateX(1000px) rotate(30deg)';
                handleLike();
            } else if (diffX < -100) {
                // Pass
                activeCard.style.transform = 'translateX(-1000px) rotate(-30deg)';
                handlePass();
            } else {
                // Reset position
                activeCard.style.transform = 'translateX(0) rotate(0)';
                const likeIndicator = activeCard.querySelector('.like-indicator');
                const passIndicator = activeCard.querySelector('.pass-indicator');
                if (likeIndicator) likeIndicator.style.opacity = 0;
                if (passIndicator) passIndicator.style.opacity = 0;
            }
        }
        
        function handleLike() {
            // Get the match card and connect button
            const matchCard = matchCards[currentCardIndex];
            if (!matchCard) return;
            
            const connectBtn = matchCard.querySelector('.connect-btn');
            if (connectBtn && !connectBtn.disabled) {
                // Show toast
                showToast('Connection request sent!', 'success');
                
                // Submit the form if it exists
                const form = matchCard.querySelector('.connect-form');
                if (form) {
                    fetch(form.action, {
                        method: 'POST',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // Update button state to prevent multiple requests
                            connectBtn.innerHTML = '<i class="bx bx-check"></i> Requested';
                            connectBtn.className = 'btn btn-secondary connection-requested';
                            connectBtn.disabled = true;
                        }
                    })
                    .catch(error => {
                        console.error('Error sending connection request:', error);
                    });
                }
            }
            
            // Move to next card
            setTimeout(() => {
                currentCardIndex++;
                setupCurrentCard();
            }, 300);
        }
        
        function handlePass() {
            // Simply move to next card
            setTimeout(() => {
                currentCardIndex++;
                setupCurrentCard();
            }, 300);
        }
    }

    // Helper function to show toast notifications
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.innerHTML = `
            <i class='bx ${type === 'success' ? 'bx-check-circle' : 'bx-error-circle'}'></i>
            <span>${message}</span>
            <button class="close-toast"><i class='bx bx-x'></i></button>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Close button
        toast.querySelector('.close-toast').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});