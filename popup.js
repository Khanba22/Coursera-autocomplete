document.addEventListener('DOMContentLoaded', function() {
  const solveQuizButton = document.getElementById('solveQuiz');
  const completeCourseButton = document.getElementById('completeCourse');
  const statusText = document.getElementById('statusText');
  const nameInput = document.getElementById('name');
  const apiKeyInput = document.getElementById('apiKey');
  const cAuthInput = document.getElementById('cAuth');
  const csrfInput = document.getElementById('csrf');

  // Load saved values
  chrome.storage.local.get(['name', 'apiKey', 'cAuth'], function(result) {
    if (result.name) nameInput.value = result.name;
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    if (result.cAuth) cAuthInput.value = result.cAuth;
  });

  solveQuizButton.addEventListener('click', async function() {
    const name = nameInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    
    if (!name) {
      showStatus('Please enter your name', 'error');
      return;
    }
    
    if (!apiKey) {
      showStatus('Please enter your API key', 'error');
      return;
    }
    
    // Save values for future use
    chrome.storage.local.set({ name: name, apiKey: apiKey });
    
    showStatus('Processing quiz...', 'processing');
    toggleLoader(solveQuizButton, true);
    
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'solveQuiz',
        name: name,
        apiKey: apiKey
      });
      
      if (response.success) {
        showStatus('Quiz solved successfully!', 'success');
      } else {
        showStatus(`Error: ${response.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      showStatus(`Error: ${error.message || 'Extension not loaded on this page'}`, 'error');
    } finally {
      toggleLoader(solveQuizButton, false);
    }
  });

  completeCourseButton.addEventListener('click', async function() {
    const cAuth = cAuthInput.value.trim();
    let csrf = csrfInput.value.trim();
    
    if (!cAuth) {
      showStatus('Please enter your cAuth token', 'error');
      return;
    }
    
    // Save cAuth for future use
    chrome.storage.local.set({ cAuth: cAuth });
    
    showStatus('Processing course completion...', 'processing');
    toggleLoader(completeCourseButton, true);
    
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // If CSRF is empty, try to get it from the page
      if (!csrf) {
        const csrfResponse = await chrome.tabs.executeScript(tab.id, {
          code: `
            (function() {
              const cookies = document.cookie.split(';');
              for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.startsWith('CSRF3-Token=')) {
                  return cookie.substring('CSRF3-Token='.length);
                }
              }
              return null;
            })();
          `
        });
        
        csrf = csrfResponse[0];
        
        if (!csrf) {
          showStatus('Could not detect CSRF token. Please enter it manually.', 'error');
          toggleLoader(completeCourseButton, false);
          return;
        }
      }
      
      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'completeCourse',
        cAuth: cAuth,
        csrf: csrf
      });
      
      if (response && response.success) {
        showStatus('Course completion process started!', 'success');
      } else {
        showStatus(`Error: ${response?.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      showStatus(`Error: ${error.message || 'Extension not loaded on this page'}`, 'error');
    } finally {
      toggleLoader(completeCourseButton, false);
    }
  });

  // Helper function to show status messages
  function showStatus(message, type) {
    statusText.textContent = message;
    statusText.className = 'status-text ' + type;
  }

  // Helper function to toggle loader
  function toggleLoader(button, isLoading) {
    const loader = button.querySelector('.loader');
    if (isLoading) {
      loader.style.display = 'inline-block';
      button.disabled = true;
    } else {
      loader.style.display = 'none';
      button.disabled = false;
    }
  }
});