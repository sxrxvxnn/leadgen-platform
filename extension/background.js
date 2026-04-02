// Background service worker
// Handles extension lifecycle events

chrome.runtime.onInstalled.addListener(() => {
  console.log('LeadGen Engine installed.')
  // Initialize empty leads array in storage
  chrome.storage.local.get({ leads: [] }, (data) => {
    if (!data.leads) {
      chrome.storage.local.set({ leads: [] })
    }
  })
})