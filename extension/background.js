chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.action === 'injectAndScrape') {
    const tabId = message.tabId
    chrome.scripting.executeScript(
      { target: { tabId }, files: ['content.js'] },
      () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message })
          return
        }
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'scrape' }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message })
              return
            }
            sendResponse(response || { success: false, error: 'No response from content script' })
          })
        }, 500)
      }
    )
    return true
  }

  if (message.action === 'injectAndAutoScroll') {
    const tabId = message.tabId
    chrome.scripting.executeScript(
      { target: { tabId }, files: ['content.js'] },
      () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message })
          return
        }
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'autoScroll' }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message })
              return
            }
            sendResponse(response || { success: false, error: 'No response' })
          })
        }, 500)
      }
    )
    return true
  }

})