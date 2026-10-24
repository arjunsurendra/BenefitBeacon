/* global chrome */

(() => {
  if (window.__benefitBeaconBridgeInstalled) return;
  window.__benefitBeaconBridgeInstalled = true;

  const signalReady = () => {
    window.dispatchEvent(new CustomEvent("benefitbeacon:extension-ready", { detail: "0.3.0" }));
  };

  window.addEventListener("benefitbeacon:extension-probe", signalReady);
  window.addEventListener("benefitbeacon:start-application", (event) => {
    if (typeof event.detail !== "string" || event.detail.length > 100_000) return;
    let session;
    try {
      session = JSON.parse(event.detail);
    } catch {
      return;
    }

    chrome.runtime.sendMessage({ type: "BENEFITBEACON_APPLICATION_SESSION", session }).then((response) => {
      window.dispatchEvent(new CustomEvent("benefitbeacon:application-handoff", {
        detail: JSON.stringify({ ok: response?.ok === true }),
      }));
    }).catch(() => undefined);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", signalReady, { once: true });
  } else {
    signalReady();
  }
})();
