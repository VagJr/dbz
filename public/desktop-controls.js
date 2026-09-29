"use strict";
(() => {
  class DesktopControls {
    constructor(mode = "hybrid") {
      this.setMode(mode);
    }
    setMode(mode) {
      this.mode = mode === "screen" ? "screen" : "hybrid";
      this.reset();
    }
    reset() {
      this.anchor = null;
    }
    vector(strafe, forward, angle, mouseActive, anchorHeld) {
      if (this.mode === "screen" || !mouseActive) {
        this.reset();
        return { x: strafe, y: -forward };
      }
      // Share one basis for lateral movement and retreat. Moving the aim must
      // not turn an ongoing dodge into a curve or invert a held retreat.
      if (!anchorHeld) this.reset();
      else if (this.anchor === null) this.anchor = angle;
      const base = this.anchor ?? angle;
      const heading = forward < 0 ? base : angle;
      return {
        x: Math.cos(heading) * forward - Math.sin(base) * strafe,
        y: Math.sin(heading) * forward + Math.cos(base) * strafe,
      };
    }
  }
  window.UZDesktopControls = DesktopControls;
})();
