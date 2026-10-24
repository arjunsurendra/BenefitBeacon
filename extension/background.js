/* global chrome */

const SESSION_KEY = "benefitbeaconApplicationSession";

async function configureSidePanel() {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  configureSidePanel().catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "BENEFITBEACON_APPLICATION_SESSION") return false;

  const session = message.session;
  const valid = session
    && session.version === 1
    && typeof session.createdAt === "string"
    && typeof session.apiBase === "string"
    && session.program
    && typeof session.program.id === "string"
    && typeof session.program.name === "string"
    && typeof session.program.applyUrl === "string";

  if (!valid) {
    sendResponse({ ok: false });
    return false;
  }

  const safeSession = {
    ...session,
    sourceTabId: sender.tab?.id,
    receivedAt: new Date().toISOString(),
  };

  chrome.storage.local.set({ [SESSION_KEY]: safeSession }).then(
    () => sendResponse({ ok: true }),
    () => sendResponse({ ok: false }),
  );
  return true;
});
