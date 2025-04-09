// Enhanced Gallery Upload Experience
document.addEventListener('DOMContentLoaded', function() {
    // ========== CORE ELEMENTS ==========
    const fileInput = document.getElementById('fileInput');
    const fileStatus = document.getElementById('fileStatus');
    const fileStatusText = document.getElementById('fileStatusText');
    const uploadForm = document.getElementById('uploadForm');
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    const isPrivateCheckbox = document.getElementById('isPrivate');
    const privacyText = document.getElementById('privacyText');
    const publicIcon = document.getElementById('publicIcon');
    const privateIcon = document.getElementById('privateIcon');
    const descriptionField = document.getElementById('description');
    const charCount = document.getElementById('charCount');
    const uploadArea = document.querySelector('.upload-area');
    const uploadPreview = document.getElementById('upload-preview');
    const imagePreview = document.getElementById('image-preview');
    const previewImage = document.getElementById('preview-image');
    const removePreviewBtn = document.getElementById('remove-preview');
    const progressContainer = document.querySelector('.upload-progress');
    const progressBar = document.querySelector('.upload-progress-bar');

    // ========== IMAGE UPLOAD AND PREVIEW ==========
    if (fileInput) {
        // Handle file selection via input change
        fileInput.addEventListener('change', function() {
            handleFileSelection(this.files);
        });
    }

    // Remove image preview
    if (removePreviewBtn) {
        removePreviewBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            resetFileUpload();
        });
    }

    function handleFileSelection(files) {
        if (!files || !files.length) return;
        
        const file = files[0];
        
        // Validate file type
        if (!file.type.match('image.*')) {
            showToast("Please select an image file", "error");
            resetFileUpload();
            return;
        }
        
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showToast("File is too large (max 5MB)", "error");
            resetFileUpload();
            return;
        }
        
        // Format file size for display
        const formattedSize = file.size < 1024 * 1024 
            ? `${(file.size / 1024).toFixed(1)} KB` 
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        
        // Update file info display
        fileStatusText.textContent = `${file.name} (${formattedSize})`;
        fileStatus.classList.add('active');
        uploadSubmitBtn.disabled = false;
        
        // Generate and show image preview
        if (uploadPreview && imagePreview && previewImage) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                uploadPreview.style.display = 'none';
                imagePreview.style.display = 'block';
                
                // Smooth fade-in animation
                previewImage.style.opacity = '0';
                setTimeout(() => {
                    previewImage.style.opacity = '1';
                    previewImage.style.transition = 'opacity 0.3s ease';
                }, 50);
            };
            reader.readAsDataURL(file);
        }
        
        // Visual feedback on upload area
        if (uploadArea) {
            uploadArea.classList.add('has-file');
            uploadArea.style.borderColor = 'var(--primary)';
            uploadArea.style.backgroundColor = 'var(--primary-light)';
        }

        // Focus on description field for a better workflow
        if (descriptionField) {
            setTimeout(() => descriptionField.focus(), 300);
        }
    }

    function resetFileUpload() {
        if (fileInput) fileInput.value = '';
        if (fileStatusText) fileStatusText.textContent = "No file selected";
        if (fileStatus) fileStatus.classList.remove('active');
        if (uploadSubmitBtn) uploadSubmitBtn.disabled = true;
        
        // Hide image preview
        if (uploadPreview) uploadPreview.style.display = 'block';
        if (imagePreview) imagePreview.style.display = 'none';
        if (previewImage) previewImage.src = '';
        
        // Reset upload area appearance
        if (uploadArea) {
            uploadArea.classList.remove('has-file');
            uploadArea.style.borderColor = '';
            uploadArea.style.backgroundColor = '';
        }
    }

    // ========== DRAG & DROP HANDLING ==========
    if (uploadArea) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });
        
        function highlight() {
            uploadArea.classList.add('drag-active');
            // Add pulse animation
            uploadArea.querySelector('.upload-icon')?.classList.add('pulse');
        }
        
        function unhighlight() {
            uploadArea.classList.remove('drag-active');
            uploadArea.querySelector('.upload-icon')?.classList.remove('pulse');
            
            // Only reset styles if no file is selected
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                uploadArea.style.borderColor = '';
                uploadArea.style.backgroundColor = '';
                uploadArea.classList.remove('has-file');
            }
        }
        
        // Handle dropped files
        uploadArea.addEventListener('drop', handleDrop, false);
        
        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                // Celebratory animation for successful drop
                const uploadIcon = uploadArea.querySelector('.upload-icon');
                if (uploadIcon) {
                    uploadIcon.classList.add('success-drop');
                    setTimeout(() => uploadIcon.classList.remove('success-drop'), 1000);
                }
                
                handleFileSelection(files);
                
                if (fileInput) {
                    // Update the fileInput element with the dropped file
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(files[0]);
                    fileInput.files = dataTransfer.files;
                }
            }
        }
    }

    // ========== DESCRIPTION CHARACTER COUNTER ==========
    if (descriptionField && charCount) {
        descriptionField.addEventListener('input', function() {
            const count = this.value.length;
            charCount.textContent = count;
            
            // Visual feedback as character limit approaches
            if (count > 150) {
                charCount.style.color = '#f59e0b'; // warning color
            } else if (count > 180) {
                charCount.style.color = '#ef4444'; // error color
            } else {
                charCount.style.color = '';
            }
        });
    }

    // ========== PRIVACY TOGGLE ==========
    if (isPrivateCheckbox) {
        isPrivateCheckbox.addEventListener('change', function() {
            if (privacyText) privacyText.textContent = this.checked ? "Private" : "Public";
            
            if (publicIcon && privateIcon) {
                publicIcon.style.display = this.checked ? 'none' : 'inline-block';
                privateIcon.style.display = this.checked ? 'inline-block' : 'none';
            }
            
            // Add animation for toggle
            const container = this.closest('.switch-container');
            if (container) {
                container.classList.add('privacy-changed');
                setTimeout(() => container.classList.remove('privacy-changed'), 500);
            }
        });
    }

    // ========== FORM SUBMISSION WITH VISUAL FEEDBACK ==========
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!fileInput || !fileInput.files.length) {
                showToast('Please select a file first', 'error');
                return;
            }
            
            // Show loading state
            if (uploadSubmitBtn) {
                uploadSubmitBtn.disabled = true;
                uploadSubmitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Uploading...';
            }
            
            // Show progress bar with initial animation
            if (progressContainer && progressBar) {
                progressContainer.style.display = 'block';
                progressBar.style.width = '5%'; // Start with a small width
            }
            
            // Create FormData to send files
            const formData = new FormData(this);
            
            // Use XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable && progressBar) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    // Add a slight delay to make animation smoother
                    setTimeout(() => {
                        progressBar.style.width = percentComplete + '%';
                    }, 100);
                }
            });
            
            xhr.addEventListener('load', function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // Show success animation
                    showUploadSuccess();
                    
                    // Check if we got JSON response
                    let response;
                    try {
                        response = JSON.parse(xhr.responseText);
                    } catch(e) {
                        // If not JSON, probably redirected
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                        return;
                    }
                    
                    if (response && response.success) {
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    } else {
                        resetUploadUI();
                        showToast('Upload failed: ' + (response?.message || 'Unknown error'), 'error');
                    }
                } else {
                    resetUploadUI();
                    showToast('Upload failed with status: ' + xhr.status, 'error');
                }
            });
            
            xhr.addEventListener('error', function() {
                resetUploadUI();
                showToast('Network error occurred during upload', 'error');
            });
            
            xhr.addEventListener('abort', function() {
                resetUploadUI();
                showToast('Upload aborted', 'info');
            });
            
            // Send the request
            xhr.open('POST', '/upload-gallery-photo', true);
            xhr.send(formData);
        });
    }

    function resetUploadUI() {
        if (uploadSubmitBtn) {
            uploadSubmitBtn.disabled = false;
            uploadSubmitBtn.innerHTML = '<i class="bx bx-cloud-upload"></i> Upload Photo';
        }
        
        if (progressContainer) {
            progressContainer.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
        }
    }

    function showUploadSuccess() {
        // Hide form elements
        const formElements = uploadForm.querySelectorAll(':not(.upload-success)');
        formElements.forEach(el => {
            el.style.display = 'none';
        });
        
        // Show success animation
        let successDiv = document.querySelector('.upload-success');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.className = 'upload-success';
            successDiv.innerHTML = `
                <div class="success-icon"><i class='bx bx-check-circle'></i></div>
                <div class="success-message">Photo uploaded successfully!</div>
                <div class="confetti-container"></div>
            `;
            uploadForm.appendChild(successDiv);
            
            // Trigger confetti animation
            generateConfetti(successDiv.querySelector('.confetti-container'));
        }
        
        successDiv.style.display = 'block';
    }
    
    // ========== GALLERY FILTERING & SORTING ==========
    initGalleryControls();
    
    // ========== GALLERY STATS ==========
    updateGalleryStats();
    
    // Initialize any modals or other UI components
    initGalleryModals();
});

// ========== GALLERY FILTERING & STATS FUNCTIONS ==========
function initGalleryControls() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('searchPhotos');
    const sortOptions = document.getElementById('sortOptions');
    
    // Filter functionality
    if (filterButtons.length > 0) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                // Update active state
                filterButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Apply animations to indicate filtering
                this.classList.add('filter-activated');
                setTimeout(() => this.classList.remove('filter-activated'), 500);
                
                // Get filter value and apply filtering
                const filter = this.dataset.filter;
                applyFilters(filter, searchInput?.value || '');
            });
        });
    }
    
    // Search functionality with debounce
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                // Get current filter
                const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
                applyFilters(activeFilter, this.value.toLowerCase().trim());
            }, 300);
        });
    }
    
    // Sort functionality
    if (sortOptions) {
        sortOptions.addEventListener('change', function() {
            sortGalleryItems(this.value);
            
            // Add animation feedback
            const items = document.querySelectorAll('.gallery-item');
            items.forEach((item, index) => {
                // Staggered animation
                item.style.animationDelay = `${index * 0.05}s`;
                item.classList.add('sort-animation');
                setTimeout(() => item.classList.remove('sort-animation'), 500);
            });
        });
    }
}

function applyFilters(filterType, searchTerm) {
    const items = document.querySelectorAll('.gallery-item');
    let visibleCount = 0;
    
    items.forEach(item => {
        // First check the filter type
        let passesFilter = false;
        if (filterType === 'all') {
            passesFilter = true;
        } else if (filterType === 'public' && !item.classList.contains('private')) {
            passesFilter = true;
        } else if (filterType === 'private' && item.classList.contains('private')) {
            passesFilter = true;
        }
        
        // Then check the search term
        let passesSearch = true;
        if (searchTerm) {
            const description = item.dataset.description?.toLowerCase() || '';
            const descriptionEl = item.querySelector('.photo-description');
            const descriptionText = descriptionEl?.textContent?.toLowerCase() || '';
            
            passesSearch = description.includes(searchTerm) || descriptionText.includes(searchTerm);
        }
        
        // Apply visibility
        if (passesFilter && passesSearch) {
            item.style.display = '';
            // Add staggered animation effect
            setTimeout(() => {
                item.classList.add('filter-reveal');
                setTimeout(() => item.classList.remove('filter-reveal'), 600);
            }, visibleCount * 50);
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // Show empty state if no items are visible
    const emptyState = document.querySelector('.empty-filter-message');
    if (visibleCount === 0 && !emptyState) {
        const photosGrid = document.getElementById('photosGrid');
        if (photosGrid) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-filter-message';
            emptyDiv.innerHTML = `
                <div class="empty-icon"><i class='bx bx-search-alt'></i></div>
                <p>No photos match your current filters</p>
                <button class="btn btn-outline reset-filters">
                    <i class='bx bx-reset'></i> Reset Filters
                </button>
            `;
            photosGrid.appendChild(emptyDiv);
            
            // Add reset handler
            emptyDiv.querySelector('.reset-filters').addEventListener('click', function() {
                // Reset filter buttons
                document.querySelector('.filter-btn[data-filter="all"]')?.click();
                // Reset search
                if (searchTerm && document.getElementById('searchPhotos')) {
                    document.getElementById('searchPhotos').value = '';
                    document.getElementById('searchPhotos').dispatchEvent(new Event('input'));
                }
            });
        }
    } else if (visibleCount > 0 && emptyState) {
        emptyState.remove();
    }
}

function sortGalleryItems(sortType) {
    const items = Array.from(document.querySelectorAll('.gallery-item'));
    if (items.length === 0) return;
    
    // Sort the items
    items.sort((a, b) => {
        const dateA = new Date(a.dataset.date);
        const dateB = new Date(b.dataset.date);
        
        return sortType === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    // Reappend in sorted order
    const photosContainer = document.getElementById('photosGrid');
    if (photosContainer) {
        items.forEach(item => {
            photosContainer.appendChild(item);
        });
    }
}

function updateGalleryStats() {
    const publicCount = document.getElementById('publicPhotoCount');
    const privateCount = document.getElementById('privatePhotoCount');
    const completionText = document.getElementById('galleryCompletion');
    const completionBar = document.getElementById('galleryProgress');
    
    // Count photos
    const totalItems = document.querySelectorAll('.gallery-item').length;
    const privateItems = document.querySelectorAll('.gallery-item.private').length;
    const publicItems = totalItems - privateItems;
    
    // Update counters with animation
    animateCounter(publicCount, publicItems);
    animateCounter(privateCount, privateItems);
    
    // Calculate completion percentage (assuming 5 photos is 100%)
    const completionPercentage = Math.min(Math.round((totalItems / 5) * 100), 100);
    
    if (completionText) {
        // Animate percentage change
        const currentValue = parseInt(completionText.textContent) || 0;
        animateNumber(currentValue, completionPercentage, (value) => {
            completionText.textContent = `${value}%`;
        });
    }
    
    if (completionBar) {
        // Smooth animation for progress bar
        completionBar.style.transition = 'width 1s ease';
        completionBar.style.width = `${completionPercentage}%`;
    }
}

// Animate counter from current to target value
function animateCounter(element, targetValue) {
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    animateNumber(currentValue, targetValue, (value) => {
        element.textContent = value;
        
        // Add pulse animation for emphasis on change
        if (currentValue !== targetValue) {
            element.classList.add('counter-updated');
            setTimeout(() => element.classList.remove('counter-updated'), 1000);
        }
    });
}

function animateNumber(from, to, callback) {
    const duration = 1000; // ms
    const stepTime = 20; // ms
    const steps = Math.ceil(duration / stepTime);
    const increment = (to - from) / steps;
    let current = from;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        current += increment;
        if (step >= steps) {
            clearInterval(timer);
            current = to;
        }
        callback(Math.round(current));
    }, stepTime);
}

// ========== GALLERY MODALS ==========
function initGalleryModals() {
    // View Photo, Edit Photo, Toggle Privacy, and Delete Photo functionality
    const photosGrid = document.getElementById('photosGrid');
    if (photosGrid) {
        photosGrid.addEventListener('click', function(e) {
            // Handle view, edit, privacy toggle, and delete actions
            handleGalleryItemActions(e);
        });
    }
    
    // Initialize modal close buttons
    document.querySelectorAll('.close-modal, .btn-secondary').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModalHandler);
    });
    
    // Close on background click
    window.addEventListener('click', function(e) {
        document.querySelectorAll('.modal').forEach(modal => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });
    
    // ESC Key for modal closing
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(closeModal);
        }
    });
    
    // Form submission for editing
    const editPhotoForm = document.getElementById('editPhotoForm');
    if (editPhotoForm) {
        editPhotoForm.addEventListener('submit', handleEditPhotoSubmit);
    }
    
    // Delete confirmation
    const confirmDelete = document.getElementById('confirmDelete');
    if (confirmDelete) {
        confirmDelete.addEventListener('click', handleConfirmDelete);
    }
}

function closeModalHandler() {
    const modal = this.closest('.modal');
    if (modal) {
        closeModal(modal);
    }
}

function closeModal(modal) {
    // Add fade-out animation
    modal.classList.add('modal-hiding');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('modal-hiding');
        document.body.style.overflow = '';
    }, 300);
}

function handleGalleryItemActions(e) {
    // Implementation for view, edit, toggle privacy, and delete photo actions
    // ...
}

function handleEditPhotoSubmit(e) {
    // Implementation for photo editing form submission
    // ...
}

function handleConfirmDelete() {
    // Implementation for photo deletion confirmation
    // ...
}

// ========== VISUAL EFFECTS ==========
function generateConfetti(container) {
    if (!container) return;
    
    // Create confetti pieces
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.setProperty('--confetti-x', Math.random() * 100 + 'vw');
        confetti.style.setProperty('--confetti-y', Math.random() * 40 - 10 + 'vh');
        confetti.style.setProperty('--rotate', Math.random() * 360 + 'deg');
        confetti.style.setProperty('--delay', Math.random() * 1 + 's');
        confetti.style.setProperty('--color', `hsl(${Math.random() * 360}, 80%, 60%)`);
        container.appendChild(confetti);
    }
}

// ========== TOAST NOTIFICATIONS ==========
function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Choose icon based on type
    let icon = '';
    switch(type) {
        case 'success': icon = '<i class="bx bx-check"></i>'; break;
        case 'error': icon = '<i class="bx bx-x-circle"></i>'; break;
        case 'warning': icon = '<i class="bx bx-error"></i>'; break;
        default: icon = '<i class="bx bx-info-circle"></i>';
    }
    
    toast.innerHTML = `
        ${icon}
        <span>${message}</span>
        <button class="toast-close"><i class="bx bx-x"></i></button>
    `;
    
    // Add close functionality
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 300);
        });
    }
    
    toastContainer.appendChild(toast);
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Make showToast function globally available
window.showToast = showToast;