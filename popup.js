document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const solveQuizButton = document.getElementById('solveQuiz');

  // Load saved API key
  chrome.storage.local.get(['apiKey'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // Save API key when input changes
  apiKeyInput.addEventListener('change', function() {
    chrome.storage.local.set({ apiKey: apiKeyInput.value });
  });

  // Handle solve quiz button click
  solveQuizButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value;
    if (!apiKey) {
      alert('Please enter an API key first');
      return;
    }

    // Send message to content script to solve quiz
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'solveQuiz',
        apiKey: apiKey
      });
    });
  });
});