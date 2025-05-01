// Enhanced chat.js with improved error handling and reliability
document.addEventListener('DOMContentLoaded', () => {
    // Debug mode - enable with Ctrl+Shift+D
    const DEBUG = true;
    
    // DOM elements
    const messagesContainer = document.getElementById('messagesContainer');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiButton = document.getElementById('emojiButton');
    const emojis = document.querySelectorAll('.emoji');
    const emptyChatDiv = document.querySelector('.empty-chat');
    const connectionStatus = document.getElementById('connectionStatus') || createConnectionStatus();
    
    // User information from data attributes
    const currentUserId = document.body.dataset.currentUserId;
    const otherUserId = document.body.dataset.otherUserId;
    
    // Make IDs accessible in console for debugging
    window.currentUserId = currentUserId;
    window.otherUserId = otherUserId;
    
    // Socket.io connection
    let socket;
    let typingTimeout;
    let reconnectInterval;
    let pendingMessages = [];
    
    // Debug logging
    function logDebug(message, data) {
        if (!DEBUG) return;
        
        if (data) {
            console.log(`[CHAT DEBUG] ${message}`, data);
        } else {
            console.log(`[CHAT DEBUG] ${message}`);
        }
    }
    
    // Validate required parameters
    if (!currentUserId || !otherUserId) {
        console.error('Missing user IDs for chat:', { currentUserId, otherUserId });
        showErrorToast('Chat initialization failed: Missing user information');
        
        if (emptyChatDiv) {
            emptyChatDiv.innerHTML = `
                <div class="empty-chat-icon">
                    <i class="bx bx-error-circle" style="color: #ef4444;"></i>
                </div>
                <h3>Chat Initialization Failed</h3>
                <p>Could not identify the users for this chat. Please try refreshing the page.</p>
                <button id="reload-page" style="padding: 8px 16px; background: #4F46E5; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 20px;">Reload Page</button>
            `;
            
            document.getElementById('reload-page')?.addEventListener('click', () => {
                window.location.reload();
            });
        }
        
        return; // Stop initialization
    }
    
    // Initialize Socket.IO connection
    function initializeSocket() {
        try {
            logDebug(`Initializing Socket.IO with currentUserId: ${currentUserId}, otherUserId: ${otherUserId}`);
            updateConnectionStatus('connecting');
            
            // Clear any existing socket
            if (socket) {
                socket.disconnect();
                socket.removeAllListeners();
            }
            
            // Connect to Socket.IO server with improved options
            socket = io({
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000
            });
            
            // Socket event handlers
            socket.on('connect', () => {
                logDebug('Socket.IO connected successfully. Socket ID:', socket.id);
                updateConnectionStatus('connected');
                clearInterval(reconnectInterval);
                
                // Join private chat room
                socket.emit('join chat', {
                    userId: currentUserId,
                    otherUserId: otherUserId
                });
                
                logDebug('Joined chat room for users:', currentUserId, otherUserId);
                
                // Send any pending messages
                if (pendingMessages.length > 0) {
                    logDebug(`Attempting to send ${pendingMessages.length} pending messages`);
                    sendPendingMessages();
                }
            });
            
            socket.on('connect_error', (error) => {
                logDebug('Socket.IO connection error:', error);
                updateConnectionStatus('disconnected');
                showErrorToast(`Connection error: ${error.message}`);
            });
            
            socket.on('disconnect', (reason) => {
                logDebug('Socket.IO disconnected, reason:', reason);
                updateConnectionStatus('disconnected');
                
                // Set up a manual reconnect interval
                if (!reconnectInterval) {
                    reconnectInterval = setInterval(() => {
                        if (!socket.connected) {
                            logDebug('Attempting to reconnect...');
                            socket.connect();
                        } else {
                            clearInterval(reconnectInterval);
                            reconnectInterval = null;
                        }
                    }, 5000);
                }
            });
            
            socket.on('error', (error) => {
                logDebug('Socket.IO error:', error);
                showErrorToast(error.message || 'Connection error');
            });
            
            // Handle chat joined confirmation
            socket.on('chat joined', (data) => {
                logDebug('Successfully joined chat room:', data);
                if (data.success) {
                    updateConnectionStatus('connected');
                }
            });
            
            // Handle receiving messages
            socket.on('message', (data) => {
                logDebug('Received message:', data);
                
                if (emptyChatDiv) {
                    emptyChatDiv.style.display = 'none';
                }
                
                if (data.sender === currentUserId) {
                    // Update our own message status
                    updateMessageStatus(data._id, 'sent');
                    
                    // Remove from pending messages if it exists
                    pendingMessages = pendingMessages.filter(msg => msg.id !== data._id);
                } else {
                    // Add the other user's message to UI
                    addMessageToUI({
                        id: data._id,
                        sender: data.sender,
                        content: data.content,
                        timestamp: new Date(data.timestamp),
                        status: 'received'
                    });
                    
                    // Mark as seen
                    socket.emit('message seen', {
                        messageId: data._id,
                        sender: currentUserId,
                        receiver: data.sender
                    });
                }
            });
            
            // Handle message sent confirmation
            socket.on('message sent', (data) => {
                logDebug('Message sent confirmation:', data);
                updateMessageStatus(data._id, 'sent');
                
                // Remove from pending messages if it exists
                pendingMessages = pendingMessages.filter(msg => msg.id !== data._id);
            });
            
            // Handle message delivered confirmation
            socket.on('message delivered', (data) => {
                logDebug('Message delivered confirmation:', data);
                updateMessageStatus(data.messageId, 'delivered');
            });
            
            // Handle typing indicators
            socket.on('typing', (data) => {
                if (data.userId === otherUserId) {
                    showTypingIndicator();
                }
            });
            
            socket.on('stop typing', (data) => {
                if (data.userId === otherUserId) {
                    hideTypingIndicator();
                }
            });
            
            // Handle online status updates
            socket.on('user status', (data) => {
                if (data.userId === otherUserId) {
                    updateUserStatus(data.status, data.lastActive);
                }
            });
            
            // Handle message seen confirmation
            socket.on('message seen', (data) => {
                logDebug('Message seen confirmation:', data);
                if (data.reader === otherUserId) {
                    updateMessageStatus(data.messageId, 'read');
                }
            });
            
        } catch (error) {
            logDebug('Error initializing Socket.IO:', error);
            updateConnectionStatus('disconnected');
            showErrorToast('Failed to connect to chat server: ' + error.message);
        }
    }
    
    // Function to send pending messages
    function sendPendingMessages() {
        if (!socket || !socket.connected || pendingMessages.length === 0) return;
        
        logDebug(`Sending ${pendingMessages.length} pending messages`);
        
        // Clone the array to avoid modification issues during iteration
        const messages = [...pendingMessages];
        
        messages.forEach(msg => {
            socket.emit('send message', {
                messageId: msg.id,
                sender: currentUserId,
                receiver: otherUserId,
                content: msg.content,
                timestamp: msg.timestamp
            });
        });
    }
    
    // Show debug panel with Ctrl+Shift+D
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            checkSocketConnection();
        }
    });
    
    // Debug function to check socket connection
    function checkSocketConnection() {
        logDebug('Checking socket connection...');
        
        if (!socket) {
            logDebug('Socket not initialized');
            return false;
        }
        
        logDebug(`Socket ID: ${socket.id}, Connected: ${socket.connected}`);
        
        // Display connection details
        const details = document.createElement('div');
        details.className = 'debug-panel';
        details.innerHTML = `
            <h3>Chat Debug Panel</h3>
            <p><strong>Socket Connection:</strong> ${socket.connected ? 'Connected' : 'Disconnected'}</p>
            <p><strong>Socket ID:</strong> ${socket.id || 'None'}</p>
            <p><strong>Transport:</strong> ${socket.io?.engine?.transport?.name || 'N/A'}</p>
            <p><strong>Current User:</strong> ${currentUserId}</p>
            <p><strong>Other User:</strong> ${otherUserId}</p>
            <p><strong>Pending Messages:</strong> ${pendingMessages.length}</p>
            <div style="margin-top: 10px;">
                <button id="reconnectBtn">Reconnect Socket</button>
                <button id="reloadMsgsBtn">Reload Messages</button>
                <button id="closeDebugBtn">Close Panel</button>
            </div>
        `;
        
        // Remove existing panel if present
        const existingPanel = document.querySelector('.debug-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        document.body.appendChild(details);
        
        document.getElementById('reconnectBtn').addEventListener('click', () => {
            socket.disconnect();
            setTimeout(initializeSocket, 500);
        });
        
        document.getElementById('reloadMsgsBtn').addEventListener('click', () => {
            loadExistingMessages(true);
        });
        
        document.getElementById('closeDebugBtn').addEventListener('click', () => {
            details.remove();
        });
        
        return socket.connected;
    }
    
    // Initialize Socket.IO
    initializeSocket();
    
    // Initialize chat interface
    function initializeChat() {
        loadExistingMessages();
        
        if (messageForm) {
            messageForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const message = messageInput.value.trim();
                if (!message) return;
                
                sendMessage(message);
            });
            
            // Also handle button click separately in case form submit fails
            if (sendButton) {
                sendButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    const message = messageInput.value.trim();
                    if (!message) return;
                    
                    sendMessage(message);
                });
            }
            
            // Handle typing indicators
            if (messageInput) {
                messageInput.addEventListener('input', function() {
                    clearTimeout(typingTimeout);
                    
                    // Emit typing event
                    if (socket && socket.connected) {
                        socket.emit('typing', {
                            sender: currentUserId,
                            receiver: otherUserId
                        });
                        
                        // Set timeout to stop typing
                        typingTimeout = setTimeout(() => {
                            socket.emit('stop typing', {
                                sender: currentUserId,
                                receiver: otherUserId
                            });
                        }, 3000); // Stop typing after 3 seconds of inactivity
                    }
                });
            }
        }
        
        // Add event listeners to conversation starter chips
        const starterChips = document.querySelectorAll('.starter-chip');
        starterChips.forEach(chip => {
            chip.addEventListener('click', function() {
                if (messageInput) {
                    messageInput.value = this.textContent;
                    messageInput.focus();
                }
            });
        });
        
        // Initialize emoji picker
        if (emojiButton && emojiPicker) {
            emojiButton.addEventListener('click', function() {
                emojiPicker.classList.toggle('show');
            });
            
            emojis.forEach(emoji => {
                emoji.addEventListener('click', function() {
                    messageInput.value += this.textContent;
                    emojiPicker.classList.remove('show');
                    messageInput.focus();
                });
            });
        }
    }
    
    // Load existing messages from the server
    function loadExistingMessages(isForceReload = false) {
        // Show loading indicator or replace empty chat with loading indicator
        if (isForceReload) {
            // Clear existing messages if force reloading
            while (messagesContainer.firstChild) {
                messagesContainer.removeChild(messagesContainer.firstChild);
            }
        }
        
        // Add loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Loading messages...';
        messagesContainer.appendChild(loadingIndicator);
        
        logDebug(`Loading messages for conversation with ${otherUserId}`);
        
        fetch(`/api/messages/${otherUserId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Remove loading indicator
                const loadingElem = messagesContainer.querySelector('.loading-indicator');
                if (loadingElem) loadingElem.remove();
                
                if (data.success && data.messages && data.messages.length > 0) {
                    // Hide empty chat message
                    if (emptyChatDiv) {
                        emptyChatDiv.style.display = 'none';
                    }
                    
                    logDebug(`Loaded ${data.messages.length} messages`);
                    
                    // Add messages to UI
                    data.messages.forEach(msg => {
                        addMessageToUI({
                            id: msg._id || generateTempId(),
                            sender: msg.sender,
                            content: msg.content,
                            timestamp: new Date(msg.timestamp),
                            status: msg.read ? 'read' : (msg.delivered ? 'delivered' : 'sent')
                        });
                    });
                    
                    // Scroll to bottom
                    scrollToBottom();
                    
                    // Mark all messages as read
                    fetch(`/api/messages/read/${otherUserId}`, {
                        method: 'POST'
                    }).catch(error => {
                        logDebug('Error marking messages as read:', error);
                    });
                } else {
                    logDebug('No messages found or empty response');
                    
                    // Show empty chat if we don't have messages
                    if (emptyChatDiv && (isForceReload || messagesContainer.childElementCount === 0)) {
                        emptyChatDiv.style.display = 'flex';
                    }
                }
            })
            .catch(error => {
                logDebug('Error loading messages:', error);
                
                // Remove loading indicator
                const loadingElem = messagesContainer.querySelector('.loading-indicator');
                if (loadingElem) loadingElem.remove();
                
                // Add error message
                const errorMsg = document.createElement('div');
                errorMsg.className = 'error-message';
                errorMsg.innerHTML = `
                    <i class="bx bx-error-circle"></i> Failed to load messages. 
                    <a href="#" class="retry-link">Retry</a>
                `;
                messagesContainer.appendChild(errorMsg);
                
                // Add retry link handler
                errorMsg.querySelector('.retry-link').addEventListener('click', (e) => {
                    e.preventDefault();
                    errorMsg.remove();
                    loadExistingMessages(isForceReload);
                });
                
                showErrorToast('Failed to load messages: ' + error.message);
            });
    }
    
    // Generate a temporary ID for messages
    function generateTempId() {
        return 'temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }
    
    // Send a message
    function sendMessage(message) {
        // Generate message ID
        const messageId = generateTempId();
        const timestamp = new Date();
        
        // Add message to UI immediately for responsiveness
        addMessageToUI({
            id: messageId,
            sender: currentUserId,
            content: message,
            timestamp: timestamp,
            status: 'sending'
        });
        
        // Clear input and hide empty chat
        messageInput.value = '';
        if (emptyChatDiv) {
            emptyChatDiv.style.display = 'none';
        }
        
        // Create message object
        const messageObj = {
            id: messageId,
            content: message,
            timestamp: timestamp,
            status: 'sending'
        };
        
        // Try to send via Socket.IO first
        if (socket && socket.connected) {
            socket.emit('send message', {
                messageId: messageId,
                sender: currentUserId,
                receiver: otherUserId,
                content: message,
                timestamp: timestamp
            });
            
            // Clear typing indicator
            clearTimeout(typingTimeout);
            socket.emit('stop typing', {
                sender: currentUserId,
                receiver: otherUserId
            });
            
            // Set timeout to detect if message is not acknowledged
            setTimeout(() => {
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageElement && messageElement.querySelector('.status-sending')) {
                    logDebug(`Message ${messageId} not acknowledged, adding to pending queue`);
                    // Add to pending queue if not acknowledged after 5 seconds
                    if (!pendingMessages.some(msg => msg.id === messageId)) {
                        pendingMessages.push(messageObj);
                    }
                }
            }, 5000);
        } else {
            // Store message in pending queue
            pendingMessages.push(messageObj);
            logDebug('Socket not connected, adding to pending queue:', messageObj);
            
            // Try reconnecting socket
            if (!socket || !socket.connected) {
                initializeSocket();
            }
            
            // Fallback to HTTP if socket not available
            logDebug('Using HTTP fallback for message');
            fetch(`/chat/${otherUserId}?message=${encodeURIComponent(message)}`, {
                method: 'GET'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}`);
                }
                return response.json().catch(() => ({ success: true })); // Handle non-JSON responses
            })
            .then(data => {
                logDebug('HTTP message sent successfully');
                updateMessageStatus(messageId, 'sent');
                
                // Remove from pending queue
                pendingMessages = pendingMessages.filter(msg => msg.id !== messageId);
            })
            .catch(error => {
                logDebug('Error sending message via HTTP:', error);
                updateMessageStatus(messageId, 'error');
                showErrorToast('Failed to send message: ' + error.message);
            });
        }
    }
    
    // Add a message to the UI
    function addMessageToUI(messageData) {
        if (!messagesContainer) return;
        
        const { id, sender, content, timestamp, status = 'sent' } = messageData;
        
        // Handle system messages separately
        if (sender === 'system') {
            const systemMessage = document.createElement('div');
            systemMessage.className = 'message system';
            systemMessage.innerHTML = `
                <div class="message-content">
                    <p>${content}</p>
                </div>
            `;
            messagesContainer.appendChild(systemMessage);
            scrollToBottom();
            return;
        }
        
        // Check if message already exists
        const existingMessage = document.querySelector(`[data-message-id="${id}"]`);
        if (existingMessage) {
            // Update existing message status
            updateMessageStatus(id, status);
            return;
        }
        
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender === currentUserId ? 'outgoing' : 'incoming'}`;
        messageDiv.dataset.messageId = id;
        
        // Format timestamp
        const messageTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Create message status indicator
        let statusIcon = '';
        if (sender === currentUserId) {
            switch (status) {
                case 'sending':
                    statusIcon = '<span class="message-status status-sending"><i class="bx bx-time"></i></span>';
                    break;
                case 'sent':
                    statusIcon = '<span class="message-status status-sent"><i class="bx bx-check"></i></span>';
                    break;
                case 'delivered':
                    statusIcon = '<span class="message-status status-delivered"><i class="bx bx-check-double"></i></span>';
                    break;
                case 'read':
                    statusIcon = '<span class="message-status status-read"><i class="bx bx-check-double"></i></span>';
                    break;
                case 'error':
                    statusIcon = '<span class="message-status status-error"><i class="bx bx-error"></i></span>';
                    break;
            }
        }
        
        // Set the HTML content
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${content}</p>
                <span class="message-time">${messageTime} ${statusIcon}</span>
            </div>
        `;
        
        // Add to container
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        scrollToBottom();
    }
    
    // Update the status of a specific message
    function updateMessageStatus(messageId, status) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) {
            logDebug(`Message element not found for ID: ${messageId}`);
            return;
        }
        
        const statusElement = messageElement.querySelector('.message-status');
        if (!statusElement) {
            logDebug(`Status element not found in message: ${messageId}`);
            return;
        }
        
        // Update CSS class
        statusElement.className = `message-status status-${status}`;
        
        // Update icon
        switch (status) {
            case 'sending':
                statusElement.innerHTML = '<i class="bx bx-time"></i>';
                break;
            case 'sent':
                statusElement.innerHTML = '<i class="bx bx-check"></i>';
                break;
            case 'delivered':
                statusElement.innerHTML = '<i class="bx bx-check-double"></i>';
                break;
            case 'read':
                statusElement.innerHTML = '<i class="bx bx-check-double"></i>';
                break;
            case 'error':
                statusElement.innerHTML = '<i class="bx bx-error"></i>';
                break;
        }
        
        // Update pending message status if it exists
        const pendingIndex = pendingMessages.findIndex(msg => msg.id === messageId);
        if (pendingIndex >= 0) {
            pendingMessages[pendingIndex].status = status;
            
            // Remove from pending if no longer needed
            if (status === 'sent' || status === 'delivered' || status === 'read') {
                pendingMessages.splice(pendingIndex, 1);
            }
        }
    }
    
    // Update connection status indicator
    function updateConnectionStatus(status) {
        if (!connectionStatus) return;
        
        connectionStatus.className = `connection-status ${status}`;
        const icon = connectionStatus.querySelector('.status-icon');
        const text = connectionStatus.querySelector('.status-text');
        
        if (icon && text) {
            switch (status) {
                case 'connected':
                    icon.innerHTML = '<i class="bx bx-wifi"></i>';
                    text.textContent = 'Connected';
                    connectionStatus.classList.add('show');
                    setTimeout(() => {
                        connectionStatus.classList.remove('show');
                    }, 3000);
                    break;
                case 'connecting':
                    icon.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i>';
                    text.textContent = 'Connecting...';
                    connectionStatus.classList.add('show');
                    break;
                case 'disconnected':
                    icon.innerHTML = '<i class="bx bx-wifi-off"></i>';
                    text.textContent = 'Disconnected';
                    connectionStatus.classList.add('show');
                    break;
            }
        }
    }
    
    // Show error toast message
    function showErrorToast(message) {
        // Create toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast toast-error';
        toast.innerHTML = `
            <i class="bx bx-error-circle"></i>
            <span>${message}</span>
            <button class="close-toast">×</button>
        `;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Show toast with animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Add close button handler
        toast.querySelector('.close-toast').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        });
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
    
    // Show typing indicator
    function showTypingIndicator() {
        // Check if typing indicator already exists
        if (messagesContainer.querySelector('.typing-indicator')) {
            return;
        }
        
        // Create typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = `
            <div class="typing-animation">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        // Add to container
        messagesContainer.appendChild(typingIndicator);
        scrollToBottom();
    }
    
    // Hide typing indicator
    function hideTypingIndicator() {
        const typingIndicator = messagesContainer.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    // Update user status
    function updateUserStatus(status, lastActive) {
        const statusIndicator = document.querySelector('.user-status i');
        const statusText = document.querySelector('.user-status');
        
        if (statusIndicator && statusText) {
            if (status === 'online') {
                statusIndicator.className = 'bx bxs-circle online';
                statusText.innerHTML = '<i class="bx bxs-circle online"></i> Online';
            } else {
                statusIndicator.className = 'bx bxs-circle offline';
                
                // Format last active time
                let lastActiveText = 'Offline';
                if (lastActive) {
                    const now = new Date();
                    const lastActiveDate = new Date(lastActive);
                    const diffMs = now - lastActiveDate;
                    
                    if (diffMs < 60000) { // less than a minute
                        lastActiveText = 'Last seen just now';
                    } else if (diffMs < 3600000) { // less than an hour
                        const minutes = Math.floor(diffMs / 60000);
                        lastActiveText = `Last seen ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
                    } else if (diffMs < 86400000) { // less than a day
                        const hours = Math.floor(diffMs / 3600000);
                        lastActiveText = `Last seen ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
                    } else {
                        const days = Math.floor(diffMs / 86400000);
                        lastActiveText = `Last seen ${days} ${days === 1 ? 'day' : 'days'} ago`;
                    }
                }
                
                statusText.innerHTML = `<i class="bx bxs-circle offline"></i> ${lastActiveText}`;
            }
        }
        
        // Update avatar status indicator
        const avatarStatusIndicator = document.querySelector('.avatar .status-indicator');
        if (avatarStatusIndicator) {
            avatarStatusIndicator.className = `status-indicator ${status === 'online' ? 'online' : 'offline'}`;
        }
    }
    
    // Create connection status element if it doesn't exist
    function createConnectionStatus() {
        const status = document.createElement('div');
        status.id = 'connectionStatus';
        status.className = 'connection-status';
        status.innerHTML = `
            <div class="status-icon">
                <i class="bx bx-wifi-off"></i>
            </div>
            <span class="status-text">Disconnected</span>
        `;
        document.body.appendChild(status);
        return status;
    }
    
    // Scroll to bottom of the messages container
    function scrollToBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    // Initialize chat
    initializeChat();
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', function(e) {
        if (emojiPicker && emojiPicker.classList.contains('show') && 
            !emojiPicker.contains(e.target) && 
            e.target !== emojiButton) {
            emojiPicker.classList.remove('show');
        }
    });
    
    // Load connection list for sidebar
    function loadConnectionList() {
        const connectionList = document.querySelector('.connection-list');
        if (!connectionList) return;
        
        // Show loading state
        connectionList.innerHTML = `
            <div class="loading-connections">
                <i class="bx bx-loader-alt bx-spin"></i>
                <span>Loading connections...</span>
            </div>
        `;
        
        fetch('/connections/list')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success && data.connections && data.connections.length > 0) {
                    connectionList.innerHTML = '';
                    
                    data.connections.forEach(conn => {
                        const connectionItem = document.createElement('a');
                        connectionItem.href = `/chat/${conn.userId}`;
                        connectionItem.className = `connection-item ${conn.userId === otherUserId ? 'active' : ''}`;
                        
                        connectionItem.innerHTML = `
                            <div class="connection-avatar">
                                <img src="${conn.photo ? `/photo/${conn.userId}` : '/default-avatar.png'}" alt="${conn.name}">
                                <span class="status-indicator ${conn.isOnline ? 'online' : 'offline'}"></span>
                            </div>
                            <div class="connection-details">
                                <div class="connection-name">${conn.name}</div>
                                <div class="connection-preview">${conn.lastMessage || 'Start a conversation'}</div>
                            </div>
                            ${conn.unreadCount ? `<div class="unread-badge">${conn.unreadCount}</div>` : ''}
                        `;
                        
                        connectionList.appendChild(connectionItem);
                    });
                } else {
                    connectionList.innerHTML = `
                        <div class="empty-connections">
                            <p>You don't have any connections yet.</p>
                            <a href="/matches" class="empty-action">Find Matches</a>
                        </div>
                    `;
                }
            })
            .catch(error => {
                logDebug('Error loading connections:', error);
                connectionList.innerHTML = `
                    <div class="empty-connections">
                        <p>Failed to load connections.</p>
                        <a href="#" class="empty-action retry-connections">Retry</a>
                    </div>
                `;
                
                connectionList.querySelector('.retry-connections')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadConnectionList();
                });
            });
    }
    
    // Initialize connection list
    loadConnectionList();
    
    // Handle search in connection list
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase().trim();
            const connectionItems = document.querySelectorAll('.connection-item');
            
            if (query === '') {
                // Show all connections
                connectionItems.forEach(item => {
                    item.style.display = '';
                });
                
                // Remove any empty search results message
                const emptyResults = document.querySelector('.empty-search-results');
                if (emptyResults) emptyResults.remove();
                return;
            }
            
            let hasVisibleItems = false;
            
            // Filter connections
            connectionItems.forEach(item => {
                const name = item.querySelector('.connection-name').textContent.toLowerCase();
                const preview = item.querySelector('.connection-preview').textContent.toLowerCase();
                
                if (name.includes(query) || preview.includes(query)) {
                    item.style.display = '';
                    hasVisibleItems = true;
                } else {
                    item.style.display = 'none';
                }
            });
            
            // Show message if no results
            if (!hasVisibleItems) {
                if (!document.querySelector('.empty-search-results')) {
                    const emptyResults = document.createElement('div');
                    emptyResults.className = 'empty-search-results';
                    emptyResults.innerHTML = `
                        <i class="bx bx-search-alt"></i>
                        <p>No results found for "${query}"</p>
                        <button class="clear-search">Clear Search</button>
                    `;
                    
                    document.querySelector('.connection-list').appendChild(emptyResults);
                    
                    emptyResults.querySelector('.clear-search').addEventListener('click', () => {
                        searchInput.value = '';
                        searchInput.dispatchEvent(new Event('input'));
                    });
                }
            } else {
                // Remove empty results message if exists
                const emptyResults = document.querySelector('.empty-search-results');
                if (emptyResults) emptyResults.remove();
            }
        });
    }
    
    // Mobile navigation toggles
    const mobileToggle = document.querySelector('.mobile-sidebar-toggle');
    const mobileInfoToggle = document.querySelector('.mobile-info-toggle');
    const sidebar = document.querySelector('.chat-sidebar');
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
    
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('show');
        });
    }
    
    overlay.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('active');
        overlay.classList.remove('show');
    });
});