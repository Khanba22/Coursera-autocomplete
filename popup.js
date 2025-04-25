document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const solveQuizButton = document.getElementById('solveQuiz');
  const nameInput = document.getElementById('name');
  const loader = solveQuizButton.querySelector('.loader');
  const statusText = document.getElementById('statusText');

  function updateStatus(message, type) {
    statusText.textContent = message;
    statusText.className = `status-text ${type}`;
    loader.style.display = type === 'processing' ? 'inline-block' : 'none';
  }

  // Load saved name
  chrome.storage.local.get(['name'], function(result) {
    if (result.name) {
      nameInput.value = result.name;
    }
  });

  // Load saved API key
  chrome.storage.local.get(['apiKey'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // Save name when input changes
  nameInput.addEventListener('change', function() {
    chrome.storage.local.set({ name: nameInput.value });
  });

  // Save API key when input changes
  apiKeyInput.addEventListener('change', function() {
    chrome.storage.local.set({ apiKey: apiKeyInput.value });
  });

  // Handle solve quiz button click
  solveQuizButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value;
    const name = nameInput.value;

    // Check if API key is provided
    if(!name){
      alert('Please enter your name first');
      return; 
    }
    if (!apiKey) {
      alert('Please enter an API key first');
      return;
    }

    // Send message to content script to solve quiz
    updateStatus('Processing quiz...', 'processing');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'solveQuiz',
        apiKey: apiKey,
        name: name
      }, function(response) {
        if (response && response.success) {
          if (response.result && response.result.success) {
            updateStatus('Quiz solved successfully!', 'success');
          } else {
            updateStatus(response.result?.error || 'Failed to solve quiz', 'error');
          }
        } else {
          updateStatus(response?.error || 'Failed to solve quiz', 'error');
        }
      });
    });
  });
});