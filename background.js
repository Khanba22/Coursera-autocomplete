// Background script for handling extension functionality
chrome.runtime.onInstalled.addListener(() => {
  console.log('Coursera Solver Extension installed');
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getApiKey') {
    chrome.storage.local.get(['apiKey'], function(result) {
      sendResponse({ apiKey: result.apiKey });
    });
    return true;
  }
});