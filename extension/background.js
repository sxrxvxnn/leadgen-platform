chrome.runtime.onInstalled.addListener(() => {
  console.log('LeadGen Engine installed.')
  chrome.storage.local.get({ leads: [] }, (data) => {
    if (!data.leads) chrome.storage.local.set({ leads: [] })
  })
})

// Handle script injection requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'injectAndScrape') {
    const tabId = message.tabId

    // Inject content script
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).then(() => {
      // Wait for script to initialize then send scrape message
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: 'scrape' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message })
          } else {
            sendResponse({ success: true, data: response ? response.data : null })
          }
        })
      }, 500)
    }).catch((err) => {
      // Script may already be injected — try sending message directly
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: 'scrape' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: 'Could not connect to page' })
          } else {
            sendResponse({ success: true, data: response ? response.data : null })
          }
        })
      }, 300)
    })

    return true // Keep message channel open for async response
  }
})

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
        chrome.tabs.sendMessage(tabId, { action: 'scrape' }, (response) => {
          sendResponse(response || { success: false, error: 'No response from content script' })
        })
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
        chrome.tabs.sendMessage(tabId, { action: 'autoScroll' }, (response) => {
          sendResponse(response || { success: false, error: 'No response' })
        })
      }
    )
    return true
  }
})