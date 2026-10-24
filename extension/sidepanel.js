/* global chrome */

const SESSION_KEY = "benefitbeaconApplicationSession";
const SETTINGS_KEY = "benefitbeaconExtensionSettings";
const CHAT_KEY = "benefitbeaconApplicationChats";

const state = {
  session: null,
  page: null,
  pageContext: null,
  messages: [],
  pendingSuggestions: [],
  fillableFields: [],
  pendingFieldQuestion: null,
  skippedFieldIds: new Set(),
  loading: false,
  activity: "Thinking…",
  settings: { apiBase: "http://localhost:3000" },
};

const ui = {
  messages: document.getElementById("messages"),
  form: document.getElementById("chat-form"),
  input: document.getElementById("chat-input"),
  submit: document.querySelector("#chat-form button[type='submit']"),
};

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function apiBase() {
  return normalize(state.session?.apiBase || state.settings.apiBase || "http://localhost:3000").replace(/\/$/, "");
}

const svceProgram = {
  id: "svce-home-rebates",
  name: "Silicon Valley Clean Energy Home Rebates",
  level: "county",
  jurisdiction: "Silicon Valley Clean Energy service area",
  category: "utilities",
  summary: "SVCE offers rebates for qualifying electric home upgrades and related electrical work.",
  benefit: "Home electrification rebates and application guidance.",
  eligibilityText: "For qualifying SVCE residential customers and approved projects; current equipment, installation, timing, and funding rules apply.",
  applyUrl: "https://siliconvalleycleanenergy.my.site.com/GUPortal/",
  sourceUrl: "https://www.svcleanenergy.org/home-rebates/",
  sourceLabel: "Silicon Valley Clean Energy",
  sourceSnippet: "SVCE publishes current home-electrification rebate and application information.",
  relevanceReason: "This is the program connected to the active SVCE application portal.",
  relevanceScore: 100,
  lastChecked: "2026-10-15",
  matchType: "direct",
  status: "indexed",
};

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function activeProgram() {
  const tab = await activeTab();
  const url = safeUrl(tab?.url);
  if (url?.hostname === "siliconvalleycleanenergy.my.site.com") return svceProgram;
  return state.session?.program ?? null;
}

async function postJson(path, body) {
  const bases = [...new Set([apiBase(), "http://localhost:3000"])];
  let lastError = "I can’t reach BenefitBeacon at localhost:3000. Keep the local BenefitBeacon page open, then try again.";
  for (const base of bases) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
      if (response.ok) return payload;
      lastError = typeof payload.error === "string" && payload.error
        ? payload.error
        : `I couldn’t reach the answer service (${response.status}).`;
      if (base === "http://localhost:3000") break;
    } catch {
      lastError = base.includes("localhost") || base.includes("127.0.0.1")
        ? "I can’t reach BenefitBeacon at localhost:3000. Keep the local BenefitBeacon page open, then try again."
        : "I can’t reach the saved BenefitBeacon service.";
    }
  }
  throw new Error(lastError);
}

async function sendToPage(message) {
  const tab = await activeTab();
  if (!tab?.id || !safeUrl(tab.url)) throw new Error("Open the application page, then try again.");
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch {
    const origin = `${new URL(tab.url).origin}/*`;
    const allowed = await chrome.permissions.request({ origins: [origin] });
    if (!allowed) throw new Error("Allow access to this application page so I can read its field labels.");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  }
  return chrome.tabs.sendMessage(tab.id, message);
}

async function refreshPageContext() {
  const response = await sendToPage({ type: "BENEFITBEACON_CAPTURE_CONTEXT" });
  if (!response?.ok || !response.context) throw new Error("I could not read this application page.");
  state.pageContext = response.context;
  return response.context;
}

function addMessage(role, text, sources = []) {
  state.messages.push({ role, text, sources });
  renderMessages();
}

function appendLinkedText(container, text) {
  text.split("\n").forEach((line, index) => {
    if (index) container.append(document.createElement("br"));
    container.append(document.createTextNode(line));
  });
}

function renderMessages() {
  ui.messages.replaceChildren();
  state.messages.forEach((message) => {
    const article = document.createElement("article");
    article.className = `message ${message.role}`;
    const label = document.createElement("span");
    label.textContent = message.role === "user" ? "You" : "Beacon Benefit";
    const text = document.createElement("p");
    appendLinkedText(text, message.text);
    article.append(label, text);
    if (message.role === "assistant" && Array.isArray(message.sources) && message.sources.length) {
      const sources = document.createElement("div");
      sources.className = "message-sources";
      message.sources.slice(0, 4).forEach((source) => {
        const url = safeUrl(source.url);
        if (!url || url.protocol !== "https:") return;
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = `${source.title || url.hostname} ↗`;
        sources.append(link);
      });
      article.append(sources);
    }
    ui.messages.append(article);
  });

  if (state.loading) {
    const thinking = document.createElement("article");
    thinking.className = "message thinking";
    const dots = document.createElement("span");
    dots.className = "thinking-dots";
    dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
    const text = document.createElement("p");
    text.textContent = state.activity;
    thinking.append(dots, text);
    ui.messages.append(thinking);
  }
  ui.messages.scrollTop = ui.messages.scrollHeight;
}

async function saveMessages() {
  if (!state.session?.program?.id) return;
  const stored = await chrome.storage.local.get(CHAT_KEY);
  const chats = stored[CHAT_KEY] && typeof stored[CHAT_KEY] === "object" ? stored[CHAT_KEY] : {};
  chats[state.session.program.id] = state.messages.slice(-24);
  await chrome.storage.local.set({ [CHAT_KEY]: chats });
}

function optionValue(field, desired) {
  if (!field.options?.length) return desired;
  const target = normalize(desired).toLowerCase();
  const option = field.options.find((item) => normalize(item.value).toLowerCase() === target || normalize(item.text).toLowerCase() === target)
    || field.options.find((item) => normalize(item.text).toLowerCase().includes(target));
  return option?.value ?? null;
}

function directSuggestion(field) {
  if (!state.session || field.sensitive || field.hasValue) return null;
  const profile = state.session.profile ?? {};
  const label = `${field.label} ${field.autocomplete}`.toLowerCase();
  let value = null;
  if (/\b(city|town)\b/.test(label)) value = profile.city;
  else if (/\b(state|province)\b/.test(label)) value = profile.state;
  else if (/\b(zip|postal)\b/.test(label)) value = profile.zip;
  else if (/household.*(size|members|people)|number.*household/.test(label)) value = profile.householdSize;
  else if (/housing|residence.*type|rent.*own|homeowner/.test(label)) value = profile.housing === "own" ? "Own" : profile.housing === "rent" ? "Rent" : null;
  else if (/active.?duty|currently serving/.test(label) && typeof profile.activeDuty === "boolean") value = profile.activeDuty ? "Yes" : "No";
  else if (/veteran|military service/.test(label) && typeof profile.veteran === "boolean") value = profile.veteran ? "Yes" : "No";
  else if (/disab/.test(label) && typeof profile.disabled === "boolean") value = profile.disabled ? "Yes" : "No";
  else if (/caregiver|unpaid care/.test(label) && typeof profile.caregiver === "boolean") value = profile.caregiver ? "Yes" : "No";
  else if (/employment|work status/.test(label) && profile.employment) value = profile.employment[0].toUpperCase() + profile.employment.slice(1);
  if (value === null || value === undefined || value === "") return null;
  const fillValue = optionValue(field, String(value));
  return fillValue === null ? null : { fieldId: field.id, value: fillValue, display: String(value), reason: "Directly matched to information you shared." };
}

function displayValue(field, value) {
  const option = field.options?.find((item) => item.value === value || item.text === value);
  if (option) return option.text || option.value;
  if (field.type === "checkbox" || field.type === "radio") return /^(yes|true|1|checked)$/i.test(value) ? "Yes" : "No";
  return value;
}

function usefulQuestionField(field) {
  if (!field || field.sensitive || field.hasValue || state.skippedFieldIds.has(field.id)) return false;
  if (["checkbox", "radio", "range", "color"].includes(field.type)) return false;
  const label = normalize(field.label).toLowerCase();
  if (!label || label === "unlabeled field") return false;
  return !/search|filter|promo|coupon|captcha|verification code/i.test(label);
}

function fieldChoices(field) {
  return (field.options ?? [])
    .filter((option) => normalize(option.value) || normalize(option.text))
    .filter((option) => !/^(select|choose|please select|--)/i.test(normalize(option.text)))
    .slice(0, 12);
}

function askForNextSafeField() {
  const candidates = state.fillableFields.filter(usefulQuestionField);
  const field = candidates.find((item) => item.required) ?? candidates[0] ?? null;
  state.pendingFieldQuestion = field;
  if (!field) {
    addMessage("assistant", "I do not see another empty field I can safely help fill on this step. I left the page unchanged. You can still ask what a field means or what documents to prepare.");
    return;
  }
  const choices = fieldChoices(field);
  const choiceText = choices.length ? `\n\nAvailable choices: ${choices.map((choice) => choice.text || choice.value).join(" · ")}` : "";
  addMessage("assistant", `I need one detail before I can continue. What should I enter for “${field.label}”?${choiceText}\n\nReply with the answer, or say “skip.”`);
}

function looksLikeRestrictedIdentifier(value) {
  const text = normalize(value);
  return /\b\d{3}-?\d{2}-?\d{4}\b|\b(?:routing|account|passport|license|document)\s*(?:number|no\.?|#)?\s*[:#-]?\s*[a-z0-9-]{5,}\b/i.test(text);
}

function suggestionFromAnswer(field, answer) {
  if (!field || looksLikeRestrictedIdentifier(answer)) return { error: "Do not enter Social Security, account, document, or government ID numbers here. I left the page unchanged." };
  const clean = normalize(answer).slice(0, 300);
  if (!clean) return { error: "Please enter a value, or say “skip.”" };
  let value = clean;
  const choices = fieldChoices(field);
  if (choices.length) {
    value = optionValue(field, clean);
    if (value === null) return { error: `Choose one of these options for “${field.label}”: ${choices.map((choice) => choice.text || choice.value).join(" · ")}.` };
  }
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { error: "Enter a complete email address, or say “skip.”" };
  return {
    suggestion: {
      fieldId: field.id,
      value,
      display: displayValue(field, value),
      reason: "You provided this answer directly in the application chat.",
    },
  };
}

async function scanApplication() {
  const response = await sendToPage({ type: "BENEFITBEACON_SCAN_FORM" });
  if (!response?.ok || !response.page) throw new Error("I could not read the fields on this page.");
  state.page = response.page;
  return response.page;
}

async function prepareAutofill() {
  if (!state.session) {
    addMessage("assistant", "Start from BenefitBeacon and choose “Apply with BenefitBeacon” first. That securely gives me the details you already shared.");
    return;
  }
  state.loading = true;
  state.activity = "Reading this application step…";
  renderMessages();
  try {
    const page = await scanApplication();
    const fields = page.fields.filter((field) => !field.sensitive && !field.hasValue);
    state.fillableFields = fields;
    state.pendingFieldQuestion = null;
    state.skippedFieldIds = new Set();
    if (!fields.length) {
      addMessage("assistant", "I do not see any empty fields I can safely fill on this application step. You can still ask me what a field means or what to prepare.");
      return;
    }
    state.activity = "Matching what you shared…";
    renderMessages();
    const direct = fields.flatMap((field) => {
      const suggestion = directSuggestion(field);
      return suggestion ? [suggestion] : [];
    });
    const program = await activeProgram();
    const payload = await postJson("/api/form-assist", {
      fields,
      profile: state.session.profile ?? {},
      program,
      page: { title: page.title, host: safeUrl(page.pageUrl)?.hostname || "" },
    });
    const fieldMap = new Map(fields.map((field) => [field.id, field]));
    const combined = new Map(direct.map((suggestion) => [suggestion.fieldId, suggestion]));
    if (Array.isArray(payload.suggestions)) {
      payload.suggestions.forEach((suggestion) => {
        const field = fieldMap.get(suggestion.fieldId);
        if (!field || typeof suggestion.value !== "string" || suggestion.confidence < .82) return;
        combined.set(suggestion.fieldId, {
          fieldId: suggestion.fieldId,
          value: suggestion.value,
          display: displayValue(field, suggestion.value),
          reason: normalize(suggestion.reason) || "Matched to information you shared.",
        });
      });
    }
    state.pendingSuggestions = [...combined.values()];
    if (!state.pendingSuggestions.length) {
      askForNextSafeField();
      return;
    }
    const lines = state.pendingSuggestions.map((suggestion) => {
      const field = fieldMap.get(suggestion.fieldId);
      return `• ${field?.label || "Field"}: ${suggestion.display}`;
    });
    addMessage("assistant", `I can fill these ${state.pendingSuggestions.length} fields:\n\n${lines.join("\n")}\n\nReply “fill them” to continue, or “cancel” to leave the page unchanged.`);
  } catch (error) {
    addMessage("assistant", error.message || "I could not read this application page. Open the form and try again.");
  } finally {
    state.loading = false;
    renderMessages();
    await saveMessages();
  }
}

async function fillPendingSuggestions() {
  if (!state.pendingSuggestions.length) return;
  state.loading = true;
  state.activity = "Filling the answers you approved…";
  renderMessages();
  try {
    const response = await sendToPage({
      type: "BENEFITBEACON_FILL_FIELDS",
      items: state.pendingSuggestions.map(({ fieldId, value }) => ({ fieldId, value })),
    });
    if (!response?.ok) throw new Error(response?.error || "I could not fill those fields.");
    const skipped = response.skipped?.length ?? 0;
    state.pendingSuggestions = [];
    addMessage("assistant", `I filled ${response.filled} field${response.filled === 1 ? "" : "s"}.${skipped ? ` I left ${skipped} field${skipped === 1 ? "" : "s"} unchanged.` : ""} Please review the page before you save or continue. I will never submit the application for you. Say “fill this page” again if you want help with the next empty fields.`);
  } catch (error) {
    addMessage("assistant", error.message || "I could not fill those fields. The application was not submitted.");
  } finally {
    state.loading = false;
    renderMessages();
    await saveMessages();
  }
}

function isFillRequest(question) {
  return /\b(auto.?fill|fill (?:in |out )?(?:this |the )?(?:page|form|application)|help me fill|use what i shared)\b/i.test(question);
}

function isConfirmation(question) {
  return /^(yes|yes please|ok|okay|confirm|fill|fill them|go ahead|do it)$/i.test(question);
}

function isCancellation(question) {
  return /^(no|no thanks|cancel|stop|never mind|nevermind)$/i.test(question);
}

function isSkipRequest(question) {
  return /^(skip|skip it|pass|prefer not to answer|i prefer not to answer)$/i.test(question);
}

async function askProgramQuestion(question) {
  const program = await activeProgram();
  state.loading = true;
  state.activity = "Reading this page and checking official information…";
  renderMessages();
  ui.submit.disabled = true;
  try {
    const pageContext = await refreshPageContext();
    const history = state.messages.slice(-8);
    const payload = await postJson("/api/program-chat", {
      programId: program?.id,
      program,
      pageContext,
      question,
      history,
      profile: state.session?.profile ?? {},
    });
    if (typeof payload.answer !== "string") throw new Error("I received an empty answer. Please try your question again.");
    addMessage("assistant", payload.answer, payload.sources ?? []);
  } catch (error) {
    addMessage("assistant", error.message || "I couldn’t answer that question. Keep BenefitBeacon open and try again.");
  } finally {
    state.loading = false;
    ui.submit.disabled = false;
    renderMessages();
    await saveMessages();
  }
}

async function handleQuestion(rawQuestion) {
  const question = normalize(rawQuestion);
  if (!question || state.loading) return;
  addMessage("user", question);
  ui.input.value = "";
  if (state.pendingFieldQuestion) {
    const field = state.pendingFieldQuestion;
    if (isSkipRequest(question) || isCancellation(question)) {
      state.skippedFieldIds.add(field.id);
      state.pendingFieldQuestion = null;
      askForNextSafeField();
      await saveMessages();
      return;
    }
    const result = suggestionFromAnswer(field, question);
    if (result.error) {
      addMessage("assistant", result.error);
      await saveMessages();
      return;
    }
    state.pendingFieldQuestion = null;
    state.pendingSuggestions = [result.suggestion];
    addMessage("assistant", `I can enter this:\n\n• ${field.label}: ${result.suggestion.display}\n\nReply “fill them” to continue, or “cancel” to leave it unchanged.`);
    await saveMessages();
    return;
  }
  if (state.pendingSuggestions.length && isConfirmation(question)) {
    await fillPendingSuggestions();
    return;
  }
  if (state.pendingSuggestions.length && isCancellation(question)) {
    state.pendingSuggestions = [];
    addMessage("assistant", "Okay. I left the page unchanged. What else would you like help with?");
    await saveMessages();
    return;
  }
  if (isFillRequest(question)) {
    await prepareAutofill();
    return;
  }
  await askProgramQuestion(question);
}

async function loadSession() {
  const stored = await chrome.storage.local.get([SESSION_KEY, SETTINGS_KEY]);
  state.session = stored[SESSION_KEY] ?? null;
  state.settings = { ...state.settings, ...(stored[SETTINGS_KEY] ?? {}) };
  if (state.session?.program?.id) {
    const chats = await chrome.storage.local.get(CHAT_KEY);
    const existing = chats[CHAT_KEY]?.[state.session.program.id];
    const obsoleteMessages = new Set([
      "I could not answer right now.",
      "I could not confidently match any empty fields to the details you shared. I left the page unchanged.",
    ]);
    state.messages = Array.isArray(existing)
      ? existing.filter((message) => !obsoleteMessages.has(normalize(message?.text))).slice(-18)
      : [];
  } else {
    state.messages = [];
  }
  if (!state.messages.length) {
    state.messages.push({
      role: "assistant",
      text: state.session
        ? "I’m with you while you apply. Ask me about this application, or say “fill this page” to use the details you already shared."
        : "I’m your benefit agent. Ask me about the application page, a field, or a benefit term. Start from BenefitBeacon if you also want me to use details you already shared.",
      sources: [],
    });
  }
  renderMessages();
  ui.input.focus();
  refreshPageContext().catch(() => undefined);
}

ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  void handleQuestion(ui.input.value);
});

ui.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    ui.form.requestSubmit();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[SESSION_KEY]) return;
  state.session = changes[SESSION_KEY].newValue ?? null;
  state.pendingSuggestions = [];
  state.fillableFields = [];
  state.pendingFieldQuestion = null;
  state.skippedFieldIds = new Set();
  void loadSession();
});

chrome.tabs.onActivated.addListener(() => {
  state.page = null;
  state.pageContext = null;
  state.pendingSuggestions = [];
  state.fillableFields = [];
  state.pendingFieldQuestion = null;
  state.skippedFieldIds = new Set();
  refreshPageContext().catch(() => undefined);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!tab.active || changeInfo.status !== "complete") return;
  state.page = null;
  state.pageContext = null;
  refreshPageContext().catch(() => undefined);
});

loadSession().catch(() => {
  state.messages = [{ role: "assistant", text: "I could not load your BenefitBeacon session. Reopen the application from BenefitBeacon and try again.", sources: [] }];
  renderMessages();
});
