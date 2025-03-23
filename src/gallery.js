/**
 * CampusMatch - Gallery Functionality
 * Fixed version that properly handles photo display and interface issues
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log("Gallery initialization starting...");
    
    // ========== DOM ELEMENTS ==========
    const fileInput = document.getElementById('fileInput');
    const fileStatus = document.getElementById('fileStatus');
    const uploadForm = document.getElementById('uploadForm');
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    const isPrivateCheckbox = document.getElementById('isPrivate');
    const privacyText = document.getElementById('privacyText');
    const photosGrid = document.getElementById('photosGrid');
    const photoModal = document.getElementById('photoModal');
    const editModal = document.getElementById('editModal');
    const confirmModal = document.getElementById('confirmModal');
    const toastContainer = document.getElementById('toast-container');
    
    // Initialize photo to delete
    let photoToDelete = null;
    
    // ========== FILE UPLOAD FUNCTIONALITY ==========
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                const file = this.files[0];
                
                // Validate file type
                if (!file.type.match('image.*')) {
                    showToast("Please select an image file", "error");
                    this.value = '';
                    fileStatus.textContent = "No file selected";
                    uploadSubmitBtn.disabled = true;
                    return;
                }
                
                // Validate file size
                if (file.size > 5 * 1024 * 1024) {
                    showToast("File is too large (max 5MB)", "error");
                    this.value = '';
                    fileStatus.textContent = "No file selected";
                    uploadSubmitBtn.disabled = true;
                    return;
                }
                
                // Format file size
                const size = file.size;
                const formattedSize = size < 1024 * 1024 
                    ? `${(size / 1024).toFixed(1)} KB` 
                    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
                
                // Update file info
                fileStatus.textContent = `Selected: ${file.name} (${formattedSize})`;
                uploadSubmitBtn.disabled = false;
            } else {
                fileStatus.textContent = "No file selected";
                uploadSubmitBtn.disabled = true;
            }
        });
    }
    
    // Privacy toggle
    if (isPrivateCheckbox) {
        isPrivateCheckbox.addEventListener('change', function() {
            privacyText.textContent = this.checked ? "Private" : "Public";
        });
    }
    
    // Form submission
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault(); // Stop normal form submission
            
            if (!fileInput || !fileInput.files.length) {
                showToast('Please select a file first', 'error');
                return;
            }
            
            // Show loading state
            if (uploadSubmitBtn) {
                uploadSubmitBtn.disabled = true;
                uploadSubmitBtn.innerHTML = '<span class="icon icon-loader"></span> Uploading...';
            }
            
            // Create FormData to send files
            const formData = new FormData(this);
            
            // Log what we're submitting
            console.log("Uploading file:", fileInput.files[0].name);
            
            // Send via fetch API
            fetch('/upload-gallery-photo', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                console.log("Upload response status:", response.status);
                
                // If we got redirected, follow the redirect
                if (response.redirected) {
                    window.location.href = response.url;
                    return null;
                }
                
                return response.json();
            })
            .then(data => {
                // Reset button state if we have data (meaning no redirect happened)
                if (data) {
                    if (uploadSubmitBtn) {
                        uploadSubmitBtn.disabled = false;
                        uploadSubmitBtn.innerHTML = '<span class="icon icon-cloud-upload"></span> Upload Photo';
                    }
                    
                    if (data.success) {
                        showToast('Upload successful!', 'success');
                        // Reload the page to show new photo
                        window.location.reload();
                    } else {
                        showToast('Upload failed: ' + (data.message || 'Unknown error'), 'error');
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('Upload error - check console for details', 'error');
                
                // Reset button state
                if (uploadSubmitBtn) {
                    uploadSubmitBtn.disabled = false;
                    uploadSubmitBtn.innerHTML = '<span class="icon icon-cloud-upload"></span> Upload Photo';
                }
            });
        });
    }
    
    // ========== GALLERY INTERACTIONS ==========
    
    // Fix image paths - This is crucial
    function fixBrokenImagePaths() {
        document.querySelectorAll('.gallery-item img').forEach(img => {
            // Check if the image path starts with "/uploads/gallery/"
            if (img.src.includes('/uploads/gallery/')) {
                // Store the original path for troubleshooting
                const originalSrc = img.src;
                
                // Get the filename from the path
                const filename = originalSrc.split('/').pop();
                
                // Set a proper error handler
                img.onerror = function() {
                    console.error(`Failed to load image: ${originalSrc}`);
                    // Try the direct gallery-photo endpoint path
                    const itemContainer = this.closest('.gallery-item');
                    if (itemContainer) {
                        const photoId = itemContainer.dataset.id;
                        if (photoId) {
                            // Try an alternate path format using photoId
                            const userId = window.location.pathname.split('/').pop();
                            this.src = `/gallery-photo/${userId}/${photoId}`;
                            console.log(`Retrying with: ${this.src}`);
                            
                            // If that also fails, use the default
                            this.onerror = function() {
                                this.src = '/default-gallery-image.png';
                                this.classList.add('error-image');
                                console.error(`Failed to load image after retry: ${photoId}`);
                            };
                        } else {
                            this.src = '/default-gallery-image.png';
                            this.classList.add('error-image');
                        }
                    } else {
                        this.src = '/default-gallery-image.png';
                        this.classList.add('error-image');
                    }
                };
                
                // Trigger a reload to apply the error handler if needed
                img.src = originalSrc;
            }
        });
    }
    
    // Run image path fixing immediately
    fixBrokenImagePaths();
    
    // Photo action event delegation
    if (photosGrid) {
        photosGrid.addEventListener('click', function(e) {
            // View Photo
            const viewBtn = e.target.closest('.view-photo');
            if (viewBtn && photoModal) {
                const item = viewBtn.closest('.gallery-item');
                if (!item) return;
                
                const img = item.querySelector('img');
                const description = item.querySelector('.photo-description')?.textContent || '';
                const date = item.querySelector('.photo-date')?.textContent || '';
                const isPrivate = item.classList.contains('private');
                
                const modalImage = document.getElementById('modalImage');
                const modalDescription = document.getElementById('modalDescription');
                const modalDate = document.getElementById('modalDate');
                const modalPrivacy = document.getElementById('modalPrivacy');
                
                if (modalImage) {
                    // Use the same src but with a retried path if the original failed
                    modalImage.src = img.src;
                    modalImage.alt = description || 'Gallery photo';
                    
                    // Set up error handling for modal image
                    modalImage.onerror = function() {
                        const photoId = item.dataset.id;
                        if (photoId) {
                            // Try the gallery-photo endpoint path
                            const userId = window.location.pathname.split('/').pop();
                            this.src = `/gallery-photo/${userId}/${photoId}`;
                            
                            // If that also fails, use default
                            this.onerror = function() {
                                this.src = '/default-gallery-image.png';
                            };
                        } else {
                            this.src = '/default-gallery-image.png';
                        }
                    };
                }
                
                if (modalDescription) modalDescription.textContent = description || 'No description';
                if (modalDate) modalDate.textContent = date;
                if (modalPrivacy) {
                    modalPrivacy.textContent = isPrivate ? 'Private Photo' : 'Public Photo';
                    modalPrivacy.className = isPrivate ? 'privacy-tag private' : 'privacy-tag public';
                }
                
                photoModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
                return;
            }
            
            // Edit Photo
            const editBtn = e.target.closest('.edit-photo');
            if (editBtn && editModal) {
                const item = editBtn.closest('.gallery-item');
                if (!item) return;
                
                const photoId = item.dataset.id;
                const description = item.querySelector('.photo-description')?.textContent || '';
                const isPrivate = item.classList.contains('private');
                
                const editPhotoId = document.getElementById('editPhotoId');
                const editDescription = document.getElementById('editDescription');
                const editIsPrivate = document.getElementById('editIsPrivate');
                const editPrivacyText = document.getElementById('editPrivacyText');
                const editPublicIcon = document.getElementById('editPublicIcon');
                const editPrivateIcon = document.getElementById('editPrivateIcon');
                
                if (editPhotoId) editPhotoId.value = photoId;
                if (editDescription) editDescription.value = description;
                if (editIsPrivate) {
                    editIsPrivate.checked = isPrivate;
                    
                    if (editPrivacyText) {
                        editPrivacyText.textContent = isPrivate ? 'Private' : 'Public';
                    }
                    
                    if (editPublicIcon && editPrivateIcon) {
                        editPublicIcon.style.display = isPrivate ? 'none' : 'inline-block';
                        editPrivateIcon.style.display = isPrivate ? 'inline-block' : 'none';
                    }
                }
                
                editModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
                
                if (editDescription) {
                    setTimeout(() => { editDescription.focus(); }, 100);
                }
                return;
            }
            
            // Toggle Privacy
            const toggleBtn = e.target.closest('.toggle-privacy');
            if (toggleBtn) {
                const item = toggleBtn.closest('.gallery-item');
                if (!item) return;
                
                const photoId = item.dataset.id;
                const isCurrentlyPrivate = item.classList.contains('private');
                
                // Add loading state
                const originalBtnHTML = toggleBtn.innerHTML;
                toggleBtn.innerHTML = '<span class="icon icon-loader"></span>';
                toggleBtn.disabled = true;
                
                // Send AJAX request
                fetch(`/toggle-privacy/${photoId}`, {
                    method: 'POST',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Toggle class
                        item.classList.toggle('private');
                        
                        // Update privacy badge
                        const badge = item.querySelector('.private-badge');
                        if (isCurrentlyPrivate) {
                            if (badge) badge.remove();
                            toggleBtn.innerHTML = '<span class="icon icon-lock"></span>';
                            toggleBtn.title = 'Make Private';
                        } else {
                            if (!badge && item.querySelector('.photo-container')) {
                                const newBadge = document.createElement('span');
                                newBadge.className = 'private-badge';
                                newBadge.innerHTML = '<span class="icon icon-lock"></span> Private';
                                item.querySelector('.photo-container').appendChild(newBadge);
                            }
                            toggleBtn.innerHTML = '<span class="icon icon-lock-open"></span>';
                            toggleBtn.title = 'Make Public';
                        }
                        
                        toggleBtn.disabled = false;
                        showToast(isCurrentlyPrivate ? 'Photo is now public' : 'Photo is now private', 'success');
                        
                        // Update stats
                        updateGalleryStats();
                    } else {
                        toggleBtn.innerHTML = originalBtnHTML;
                        toggleBtn.disabled = false;
                        showToast(data.error || 'Failed to update privacy setting', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    toggleBtn.innerHTML = originalBtnHTML;
                    toggleBtn.disabled = false;
                    showToast('Error updating privacy', 'error');
                });
                return;
            }
            
            // Delete Photo
            const deleteBtn = e.target.closest('.delete-photo');
            if (deleteBtn && confirmModal) {
                const item = deleteBtn.closest('.gallery-item');
                if (!item) return;
                
                // Store the photo ID
                photoToDelete = item.dataset.id;
                console.log("Photo to delete:", photoToDelete);
                
                // Set the ID directly on the confirm button
                const confirmDelete = document.getElementById('confirmDelete');
                if (confirmDelete) confirmDelete.dataset.photoId = photoToDelete;
                
                // Show confirmation modal
                confirmModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        });
    }
    
    // Edit photo form submission
    const editPhotoForm = document.getElementById('editPhotoForm');
    if (editPhotoForm) {
        editPhotoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const editPhotoId = document.getElementById('editPhotoId');
            const editDescription = document.getElementById('editDescription');
            const editIsPrivate = document.getElementById('editIsPrivate');
            
            if (!editPhotoId || !editDescription) {
                showToast('Form elements are missing', 'error');
                return;
            }
            
            const photoId = editPhotoId.value;
            const description = editDescription.value;
            const isPrivate = editIsPrivate.checked;
            
            if (!photoId) {
                showToast('No photo selected', 'error');
                return;
            }
            
            // Show loading
            const saveBtn = this.querySelector('.save-btn');
            if (saveBtn) {
                saveBtn.innerHTML = '<span class="icon icon-loader"></span> Saving...';
                saveBtn.disabled = true;
            }
            
            // Send update request
            fetch(`/update-gallery-photo/${photoId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    description: description,
                    isPrivate: isPrivate
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update UI
                    const item = document.querySelector(`.gallery-item[data-id="${photoId}"]`);
                    if (item) {
                        const descriptionEl = item.querySelector('.photo-description');
                        if (descriptionEl) {
                            descriptionEl.textContent = description;
                        }
                        
                        // Update privacy
                        const wasPrivate = item.classList.contains('private');
                        const badge = item.querySelector('.private-badge');
                        const toggleBtn = item.querySelector('.toggle-privacy');
                        
                        if (isPrivate && !wasPrivate) {
                            item.classList.add('private');
                            
                            if (!badge && item.querySelector('.photo-container')) {
                                const newBadge = document.createElement('span');
                                newBadge.className = 'private-badge';
                                newBadge.innerHTML = '<span class="icon icon-lock"></span> Private';
                                item.querySelector('.photo-container').appendChild(newBadge);
                            }
                            
                            if (toggleBtn) {
                                toggleBtn.innerHTML = '<span class="icon icon-lock-open"></span>';
                                toggleBtn.title = 'Make Public';
                            }
                        } else if (!isPrivate && wasPrivate) {
                            item.classList.remove('private');
                            
                            if (badge) badge.remove();
                            
                            if (toggleBtn) {
                                toggleBtn.innerHTML = '<span class="icon icon-lock"></span>';
                                toggleBtn.title = 'Make Private';
                            }
                        }
                        
                        // Also update the data-description for search functionality
                        item.dataset.description = description;
                    }
                    
                    // Close modal
                    editModal.style.display = 'none';
                    document.body.style.overflow = '';
                    
                    showToast('Photo updated successfully', 'success');
                    
                    // Update stats
                    updateGalleryStats();
                } else {
                    if (saveBtn) {
                        saveBtn.innerHTML = '<span class="icon icon-check"></span> Save Changes';
                        saveBtn.disabled = false;
                    }
                    showToast(data.error || 'Failed to update photo', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                if (saveBtn) {
                    saveBtn.innerHTML = '<span class="icon icon-check"></span> Save Changes';
                    saveBtn.disabled = false;
                }
                showToast('Error updating photo', 'error');
            });
        });
        
        // Edit privacy toggle
        const editIsPrivate = document.getElementById('editIsPrivate');
        if (editIsPrivate) {
            editIsPrivate.addEventListener('change', function() {
                const editPrivacyText = document.getElementById('editPrivacyText');
                const editPublicIcon = document.getElementById('editPublicIcon');
                const editPrivateIcon = document.getElementById('editPrivateIcon');
                
                if (editPrivacyText) {
                    editPrivacyText.textContent = this.checked ? 'Private' : 'Public';
                }
                
                if (editPublicIcon && editPrivateIcon) {
                    editPublicIcon.style.display = this.checked ? 'none' : 'inline-block';
                    editPrivateIcon.style.display = this.checked ? 'inline-block' : 'none';
                }
            });
        }
    }
    
    // Confirm Delete Button
    const confirmDelete = document.getElementById('confirmDelete');
    if (confirmDelete) {
        confirmDelete.addEventListener('click', function() {
            // Get the photo ID from the data attribute
            const photoId = this.dataset.photoId || photoToDelete;
            
            if (!photoId) {
                showToast('No photo selected for deletion', 'error');
                return;
            }
            
            console.log("Attempting to delete photo:", photoId);
            
            // Show loading state
            this.innerHTML = '<span class="icon icon-loader"></span> Deleting...';
            this.disabled = true;
            
            // Send delete request
            fetch(`/delete-gallery-photo/${photoId}`, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                console.log("Delete response:", data);
                
                if (data.success) {
                    // Find and remove the item from DOM
                    const itemToDelete = document.querySelector(`.gallery-item[data-id="${photoId}"]`);
                    if (itemToDelete) {
                        itemToDelete.remove();
                        
                        // Check if gallery is now empty
                        if (document.querySelectorAll('.gallery-item').length === 0) {
                            // Show empty gallery state
                            photosGrid.innerHTML = `
                            <div class="empty-gallery">
                                <div class="empty-illustration">
                                <span class="icon icon-images" style="font-size: 3rem;"></span>
                                <div class="empty-badge"><span class="icon icon-plus"></span></div>
                                </div>
                                <h3>Your gallery is empty</h3>
                                <p>Upload your first photo to showcase your personality to potential matches</p>
                                <button type="button" class="start-upload-btn" onclick="document.getElementById('fileInput').click()">
                                <span class="icon icon-image-add"></span> Add Your First Photo
                                </button>
                            </div>
                            `;
                        }
                    }
                    
                    // Close modal
                    confirmModal.style.display = 'none';
                    document.body.style.overflow = '';
                    
                    // Show success message
                    showToast('Photo deleted successfully', 'success');
                    
                    // Update stats
                    updateGalleryStats();
                } else {
                    // Reset button
                    this.innerHTML = '<span class="icon icon-trash"></span> Delete Photo';
                    this.disabled = false;
                    
                    // Show error message
                    showToast(data.error || 'Failed to delete photo', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                
                // Reset button
                this.innerHTML = '<span class="icon icon-trash"></span> Delete Photo';
                this.disabled = false;
                
                // Close modal
                confirmModal.style.display = 'none';
                document.body.style.overflow = '';
                
                // Show error message
                showToast('Error deleting photo', 'error');
            });
        });
    }
    
    // Close modal buttons
    document.querySelectorAll('.close-modal, .cancel-btn').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    });
    
    // Close on background click
    window.addEventListener('click', function(e) {
        document.querySelectorAll('.modal').forEach(modal => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    });
    
    // ESC Key for modal closing
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
            document.body.style.overflow = '';
        }
    });
    
    // ========== GALLERY FILTERING & SORTING ==========
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
                
                // Get filter value
                const filter = this.dataset.filter;
                const items = document.querySelectorAll('.gallery-item');
                
                // Apply filter
                items.forEach(item => {
                    if (filter === 'all') {
                        item.style.display = '';
                    } else if (filter === 'public' && !item.classList.contains('private')) {
                        item.style.display = '';
                    } else if (filter === 'private' && item.classList.contains('private')) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        });
    }
    
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const items = document.querySelectorAll('.gallery-item');
            
            items.forEach(item => {
                const description = item.dataset.description?.toLowerCase() || '';
                const descriptionEl = item.querySelector('.photo-description');
                const descriptionText = descriptionEl?.textContent?.toLowerCase() || '';
                
                if (searchTerm === '' || description.includes(searchTerm) || descriptionText.includes(searchTerm)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
        
        // Clear search button
        const searchWrapper = searchInput.parentElement;
        if (searchWrapper) {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'search-clear';
            clearBtn.innerHTML = '<span class="icon icon-x"></span>';
            clearBtn.style.display = 'none';
            clearBtn.style.position = 'absolute';
            clearBtn.style.right = '30px';
            clearBtn.style.top = '50%';
            clearBtn.style.transform = 'translateY(-50%)';
            clearBtn.style.background = 'none';
            clearBtn.style.border = 'none';
            clearBtn.style.cursor = 'pointer';
            searchWrapper.appendChild(clearBtn);
            
            // Show/hide clear button
            searchInput.addEventListener('input', function() {
                clearBtn.style.display = this.value ? 'block' : 'none';
            });
            
            // Clear search
            clearBtn.addEventListener('click', function() {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
                this.style.display = 'none';
            });
        }
    }
    
    // Sort functionality
    if (sortOptions) {
        sortOptions.addEventListener('change', function() {
            const sortValue = this.value;
            const items = Array.from(document.querySelectorAll('.gallery-item'));
            
            if (items.length === 0) return;
            
            // Sort items
            items.sort((a, b) => {
                const dateA = new Date(a.dataset.date);
                const dateB = new Date(b.dataset.date);
                
                if (sortValue === 'newest') {
                    return dateB - dateA;
                } else {
                    return dateA - dateB;
                }
            });
            
            // Reappend in sorted order
            const photosContainer = document.getElementById('photosGrid');
            if (photosContainer) {
                items.forEach(item => {
                    photosContainer.appendChild(item);
                });
            }
        });
    }
    
    // ========== GALLERY STATS ==========
    function updateGalleryStats() {
        const publicCount = document.getElementById('publicPhotoCount');
        const privateCount = document.getElementById('privatePhotoCount');
        const completionText = document.getElementById('galleryCompletion');
        const completionBar = document.getElementById('galleryProgress');
        
        // Count photos
        const totalItems = document.querySelectorAll('.gallery-item').length;
        const privateItems = document.querySelectorAll('.gallery-item.private').length;
        const publicItems = totalItems - privateItems;
        
        // Update counters
        if (publicCount) publicCount.textContent = publicItems;
        if (privateCount) privateCount.textContent = privateItems;
        
        // Calculate completion percentage (assuming 5 photos is 100%)
        const completionPercentage = Math.min(Math.round((totalItems / 5) * 100), 100);
        if (completionText) completionText.textContent = `${completionPercentage}%`;
        if (completionBar) completionBar.style.width = `${completionPercentage}%`;
    }
    
    // Initialize stats
    updateGalleryStats();
    
    // ========== TOAST NOTIFICATIONS ==========
    function showToast(message, type = 'info') {
        if (!toastContainer) return;
        
        // Create toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Choose icon based on type
        let icon = '';
        switch(type) {
            case 'success': icon = '✅'; break;
            case 'error': icon = '❌'; break;
            default: icon = 'ℹ️';
        }
        
        toast.innerHTML = `
            <span>${icon}</span>
            <span>${message}</span>
            <button class="toast-close">×</button>
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
    
    // ========== MISC UI ENHANCEMENTS ==========
    
    // Enhance gallery UI with proper styling
    function enhanceGalleryUI() {
        // Add toast container styles if missing
        if (toastContainer) {
            toastContainer.style.position = 'fixed';
            toastContainer.style.bottom = '20px';
            toastContainer.style.right = '20px';
            toastContainer.style.zIndex = '9999';
        }
        
        // Fix gallery grid layout if needed
        if (photosGrid) {
            photosGrid.style.display = 'grid';
            photosGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
            photosGrid.style.gap = '20px';
        }
        
        // Enhance photo container hover effects
        document.querySelectorAll('.photo-container').forEach(container => {
            container.style.position = 'relative';
            container.style.borderRadius = '8px';
            container.style.overflow = 'hidden';
            container.style.transition = 'transform 0.3s ease';
            
            // Add hover effect
            container.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.02)';
                const overlay = this.querySelector