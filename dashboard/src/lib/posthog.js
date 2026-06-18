import posthog from 'posthog-js'

posthog.init(
  import.meta.env.VITE_POSTHOG_KEY || 'phc_uxhjJtguK9QvxBLaMTRjpA5LHxFFLGCCBNsVYBo4Awgm',
  {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: false,   // manual on route change
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage',
  }
)

export default posthog
