// Background script for handling extension functionality
chrome.runtime.onInstalled.addListener(() => {
  console.log("Coursera Solver Extension installed");
});

// Listen for tab updates to inject the content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url.includes("coursera.org")) {
    chrome.scripting
      .executeScript({
        target: { tabId: tabId },
        files: ["content-script.js"],
      })
      .catch((error) =>
        console.error("Error injecting content script:", error)
      );
  }
});
// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getApiKey") {
    chrome.storage.local.get(["apiKey"], function (result) {
      sendResponse({ apiKey: result.apiKey });
    });
    return true;
  }
});
