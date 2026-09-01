"use client";

import { useEffect } from "react";

// Some Android Chrome / WebView builds don't repaint the page at its new
// size right after the phone is rotated — the page stays rendered at the
// old (portrait) width, leaving a blank strip down the new (landscape)
// side until the user touches the screen. This is a well-known viewport
// bug, and it's known to be triggered by a viewport meta tag that pins
// maximum-scale (which this app used to set to stop the "text grows/
// shrinks on rotate" glitch — now fixed with text-size-adjust instead).
//
// As a belt-and-suspenders fix on top of removing that pin, force a
// reflow shortly after every orientation change so the browser is
// guaranteed to repaint at the correct size even on the odd WebView that
// still needs a nudge.
export default function OrientationFix() {
  useEffect(() => {
    function forceReflow() {
      const body = document.body;
      const prevDisplay = body.style.display;
      body.style.display = "none";
      // Reading offsetHeight forces the browser to flush layout before the
      // next line runs.
      void body.offsetHeight;
      body.style.display = prevDisplay;
    }

    function onOrientationChange() {
      // A short delay lets the browser finish its own resize pass first —
      // firing the reflow too early sometimes gets swallowed by that.
      setTimeout(forceReflow, 60);
      setTimeout(forceReflow, 300);
    }

    window.addEventListener("orientationchange", onOrientationChange);
    window.addEventListener("resize", onOrientationChange);
    return () => {
      window.removeEventListener("orientationchange", onOrientationChange);
      window.removeEventListener("resize", onOrientationChange);
    };
  }, []);

  return null;
}
