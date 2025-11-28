/**
 * PDF Module Test Client
 * 
 * This script handles the complete workflow for testing the PDF Module:
 * 1. Domain registration via API
 * 2. API key retrieval
 * 3. Iframe communication via postMessage
 * 4. Loading the PDF editor with authentication
 */

// ============================================
// Configuration & State
// ============================================

const state = {
  apiKey: null,
  domainId: null,
  isLoading: false,
  iframeLoaded: false,
};

// DOM Elements
const elements = {
  // Screens
  setupScreen: document.getElementById('setup-screen'),
  loadingScreen: document.getElementById('loading-screen'),
  editorScreen: document.getElementById('editor-screen'),
  
  // Form inputs
  apiBaseUrl: document.getElementById('api-base-url'),
  masterKey: document.getElementById('master-key'),
  fileUrl: document.getElementById('file-url'),
  fileName: document.getElementById('file-name'),
  domain: document.getElementById('domain'),
  webhookUrl: document.getElementById('webhook-url'),
  
  // Buttons
  registerBtn: document.getElementById('register-btn'),
  loadPdfBtn: document.getElementById('load-pdf-btn'),
  copyKeyBtn: document.getElementById('copy-key-btn'),
  backBtn: document.getElementById('back-btn'),
  
  // Status elements
  registrationStatus: document.getElementById('registration-status'),
  apiResponse: document.getElementById('api-response'),
  apiKeyCard: document.getElementById('api-key-card'),
  apiKeyValue: document.getElementById('api-key-value'),
  loadingStatus: document.getElementById('loading-status'),
  connectionStatus: document.getElementById('connection-status'),
  
  // Iframe
  pdfEditorIframe: document.getElementById('pdf-editor-iframe'),
  
  // Toast
  toastContainer: document.getElementById('toast-container'),
};

// ============================================
// Utility Functions
// ============================================

/**
 * Show a toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Switch between screens
 */
function showScreen(screenId) {
  ['setup-screen', 'loading-screen', 'editor-screen'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

/**
 * Set button loading state
 */
function setButtonLoading(button, isLoading) {
  const textEl = button.querySelector('.btn-text');
  const loadingEl = button.querySelector('.btn-loading');
  
  if (isLoading) {
    button.disabled = true;
    textEl?.classList.add('hidden');
    loadingEl?.classList.remove('hidden');
  } else {
    button.disabled = false;
    textEl?.classList.remove('hidden');
    loadingEl?.classList.add('hidden');
  }
}

/**
 * Show registration status
 */
function showStatus(type, message, responseData = null) {
  elements.registrationStatus.classList.remove('hidden', 'success', 'error', 'warning');
  elements.registrationStatus.classList.add(type);
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
  };
  
  elements.registrationStatus.querySelector('.status-icon').textContent = icons[type];
  elements.registrationStatus.querySelector('.status-text').textContent = message;
  
  if (responseData) {
    elements.apiResponse.classList.remove('hidden');
    elements.apiResponse.textContent = JSON.stringify(responseData, null, 2);
  } else {
    elements.apiResponse.classList.add('hidden');
  }
}

/**
 * Generate a dummy webhook URL
 */
function getDummyWebhookUrl() {
  const domain = elements.domain.value || 'test-client.localhost';
  return `https://${domain}/webhook/pdf-notifications`;
}

// ============================================
// API Functions
// ============================================

/**
 * Register domain and get API key
 */
async function registerDomain() {
  const baseUrl = elements.apiBaseUrl.value.replace(/\/$/, '');
  const masterKey = elements.masterKey.value.trim();
  const domain = elements.domain.value.trim();
  const webhook = elements.webhookUrl.value.trim() || getDummyWebhookUrl();
  
  // Validation
  if (!baseUrl) {
    showStatus('error', 'Please enter the PDF Module base URL');
    return;
  }
  
  if (!domain) {
    showStatus('error', 'Please enter a domain name');
    return;
  }
  
  setButtonLoading(elements.registerBtn, true);
  
  try {
    console.log('[Test Client] Registering domain:', domain);
    
    const response = await fetch(`${baseUrl}/api/domains/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: domain,
        webhook: webhook,
        master_key: masterKey || undefined,
      }),
    });
    
    const data = await response.json();
    console.log('[Test Client] Registration response:', data);
    
    if (data.success && data.data) {
      // Success - store API key
      state.apiKey = data.data.apiKey;
      state.domainId = data.data.id;
      
      showStatus('success', 'Domain registered successfully!', data);
      
      // Show API key card
      elements.apiKeyCard.classList.remove('hidden');
      elements.apiKeyValue.textContent = state.apiKey;
      
      showToast('API key retrieved successfully!', 'success');
    } else {
      // Check if domain already exists (might already have an API key)
      if (data.error && data.error.includes('already registered')) {
        showStatus('warning', 'Domain is already registered. Try a different domain or use the existing API key.', data);
        showToast('Domain already exists', 'warning');
      } else {
        showStatus('error', data.error || 'Failed to register domain', data);
        showToast('Registration failed: ' + (data.error || 'Unknown error'), 'error');
      }
    }
  } catch (error) {
    console.error('[Test Client] Registration error:', error);
    showStatus('error', `Network error: ${error.message}`);
    showToast('Network error - is the PDF Module running?', 'error');
  } finally {
    setButtonLoading(elements.registerBtn, false);
  }
}

/**
 * Create dummy field data JSON for testing
 */
function createDummyFieldData() {
  return {
    fields: [
      {
        slug: 'full_name',
        label: 'Full Name',
        inputType: 'TEXT',
        value: 'John Doe',
      },
      {
        slug: 'email',
        label: 'Email Address',
        inputType: 'EMAIL',
        value: 'john.doe@example.com',
      },
      {
        slug: 'date',
        label: 'Date',
        inputType: 'DATE',
        value: new Date().toISOString().split('T')[0],
      },
      {
        slug: 'amount',
        label: 'Amount',
        inputType: 'NUMBER',
        value: 1500,
      },
    ],
    metadata: {
      source: 'test-client',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

// ============================================
// Iframe Communication
// ============================================

/**
 * Initialize iframe and send data via postMessage
 */
function loadPdfEditor() {
  if (!state.apiKey) {
    showToast('Please register a domain first to get an API key', 'error');
    return;
  }
  
  const baseUrl = elements.apiBaseUrl.value.replace(/\/$/, '');
  const fileUrl = elements.fileUrl.value.trim();
  const fileName = elements.fileName.value.trim();
  
  if (!fileUrl) {
    showToast('Please enter a PDF file URL', 'error');
    return;
  }
  
  console.log('[Test Client] Loading PDF editor...');
  console.log('[Test Client] Base URL:', baseUrl);
  console.log('[Test Client] File URL:', fileUrl);
  console.log('[Test Client] API Key:', state.apiKey);
  
  // Show loading screen
  showScreen('loading-screen');
  elements.loadingStatus.textContent = 'Initializing iframe...';
  
  // Build iframe URL with API key for authentication
  // The api_key is required in the URL for the middleware to validate access
  const iframeUrl = new URL(baseUrl);
  iframeUrl.searchParams.set('api_key', state.apiKey);
  
  // Set iframe src with API key
  elements.pdfEditorIframe.src = iframeUrl.toString();
  console.log('[Test Client] Iframe URL:', iframeUrl.toString());
  
  // Wait for iframe to load, then send postMessage
  elements.pdfEditorIframe.onload = () => {
    console.log('[Test Client] Iframe loaded');
    state.iframeLoaded = true;
    
    elements.loadingStatus.textContent = 'Sending data to PDF Editor...';
    
    // Small delay to ensure the iframe's JS is ready
    setTimeout(() => {
      sendDataToIframe(baseUrl, fileUrl, fileName);
    }, 500);
  };
  
  elements.pdfEditorIframe.onerror = (error) => {
    console.error('[Test Client] Iframe load error:', error);
    showToast('Failed to load PDF Editor iframe', 'error');
    showScreen('setup-screen');
  };
}

/**
 * Send data to iframe via postMessage
 */
function sendDataToIframe(baseUrl, fileUrl, fileName) {
  const iframe = elements.pdfEditorIframe;
  
  // Create the message payload
  const payload = {
    type: 'PDF_EDITOR_INIT',
    fileUrl: fileUrl,
    fileName: fileName || null,
    apiKey: state.apiKey,
    fieldData: createDummyFieldData(),
    config: {
      domain: elements.domain.value,
      webhook: elements.webhookUrl.value || getDummyWebhookUrl(),
    },
  };
  
  console.log('[Test Client] Sending postMessage:', payload);
  
  // Send the message to the iframe
  iframe.contentWindow.postMessage(payload, baseUrl);
  
  // Switch to editor screen
  setTimeout(() => {
    showScreen('editor-screen');
    updateConnectionStatus('connected');
    showToast('PDF Editor loaded successfully!', 'success');
  }, 300);
}

/**
 * Update connection status badge
 */
function updateConnectionStatus(status) {
  const badge = elements.connectionStatus;
  const label = badge.querySelector('.status-label');
  
  badge.classList.remove('connected', 'error');
  
  switch (status) {
    case 'connected':
      badge.classList.add('connected');
      label.textContent = 'Connected';
      break;
    case 'error':
      badge.classList.add('error');
      label.textContent = 'Connection Error';
      break;
    default:
      label.textContent = 'Connecting...';
  }
}

/**
 * Listen for messages from the iframe
 */
function setupMessageListener() {
  window.addEventListener('message', (event) => {
    const baseUrl = elements.apiBaseUrl.value.replace(/\/$/, '');
    
    // Optional: Validate origin
    // if (event.origin !== baseUrl) return;
    
    console.log('[Test Client] Received message from iframe:', event.data);
    
    const { type, data } = event.data;
    
    switch (type) {
      case 'PDF_EDITOR_READY':
        console.log('[Test Client] PDF Editor is ready');
        updateConnectionStatus('connected');
        break;
        
      case 'PDF_EDITOR_ERROR':
        console.error('[Test Client] PDF Editor error:', data);
        showToast(`Editor error: ${data.message}`, 'error');
        updateConnectionStatus('error');
        break;
        
      case 'PDF_SAVED':
        console.log('[Test Client] PDF saved:', data);
        showToast('PDF saved successfully!', 'success');
        break;
        
      case 'FIELD_UPDATED':
        console.log('[Test Client] Field updated:', data);
        break;
        
      default:
        // Handle other message types
        break;
    }
  });
}

/**
 * Go back to setup screen
 */
function goBackToSetup() {
  // Clear iframe
  elements.pdfEditorIframe.src = 'about:blank';
  state.iframeLoaded = false;
  
  // Show setup screen
  showScreen('setup-screen');
  updateConnectionStatus('disconnected');
}

// ============================================
// Event Listeners
// ============================================

function initEventListeners() {
  // Register button
  elements.registerBtn.addEventListener('click', registerDomain);
  
  // Load PDF button
  elements.loadPdfBtn.addEventListener('click', loadPdfEditor);
  
  // Copy API key button
  elements.copyKeyBtn.addEventListener('click', () => {
    if (state.apiKey) {
      navigator.clipboard.writeText(state.apiKey).then(() => {
        showToast('API key copied to clipboard!', 'success');
      }).catch(() => {
        showToast('Failed to copy API key', 'error');
      });
    }
  });
  
  // Back button
  elements.backBtn.addEventListener('click', goBackToSetup);
  
  // Enter key on form inputs
  const inputs = [
    elements.masterKey,
    elements.domain,
    elements.webhookUrl,
  ];
  
  inputs.forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        registerDomain();
      }
    });
  });
  
  // Enter key on file URL input to load PDF
  elements.fileUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state.apiKey) {
      loadPdfEditor();
    }
  });
  
  // Setup message listener for iframe communication
  setupMessageListener();
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Test Client] Initializing...');
  initEventListeners();
  
  // Generate unique domain name based on timestamp to avoid conflicts
  const uniqueDomain = `test-client-${Date.now()}.localhost`;
  elements.domain.value = uniqueDomain;
  
  console.log('[Test Client] Ready!');
});
