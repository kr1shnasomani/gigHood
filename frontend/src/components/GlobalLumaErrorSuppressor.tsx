'use client'

/**
 * GlobalLumaErrorSuppressor
 *
 * luma.gl v3 (deck.gl's rendering engine) sets up a ResizeObserver on the
 * WebGL canvas when the map page renders.  When the user navigates away, the
 * canvas is detached from the DOM but luma.gl's ResizeObserver is NOT
 * disconnected.  On the next paint/reflow (even on completely unrelated pages)
 * the ResizeObserver fires and luma.gl tries to access:
 *
 *   this.device.limits.maxTextureDimension2D
 *
 * …but `this.device` is undefined because the WebGPU/WebGL device was already
 * torn down (or was never successfully created when navigator.gpu.requestAdapter()
 * returned null in sandboxed browser environments).
 *
 * This is a known luma.gl upstream bug. Until it is patched we intercept the
 * specific synchronous error at the window level so it does not pollute the
 * console and does not trigger React's error overlay.
 */

import { useEffect } from 'react'

export default function GlobalLumaErrorSuppressor() {
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      const msg = event.message ?? ''
      if (
        msg.includes('maxTextureDimension2D') ||
        // Also suppress the companion "Cannot set properties of undefined" variant
        // that luma.gl sometimes throws on the same code path.
        (msg.includes('Cannot read properties of undefined') &&
          event.filename?.includes('canvas-context'))
      ) {
        // Prevent the error from reaching the browser console / React overlay.
        event.preventDefault()
        event.stopImmediatePropagation()
        // Log a single quiet warning so we still know it happened.
        console.warn(
          '[gigHood] Suppressed orphaned luma.gl ResizeObserver error ' +
          '(deck.gl canvas was unmounted without disconnecting its observer). ' +
          'This is a luma.gl upstream bug and does not affect functionality.'
        )
      }
    }

    window.addEventListener('error', handler, /* capture */ true)
    return () => window.removeEventListener('error', handler, true)
  }, [])

  // Renders nothing — purely side-effect.
  return null
}
