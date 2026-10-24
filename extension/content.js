/* global chrome */

(() => {
  if (window.__benefitBeaconFormGuideInstalled) return;
  window.__benefitBeaconFormGuideInstalled = true;

  const fieldMap = new Map();
  const blockedInputTypes = new Set(["file", "password", "hidden", "submit", "button", "reset", "image"]);
  const sensitivePattern = /social\s*security|\bssn\b|taxpayer|routing|bank|account\s*(number|no\.?|#)|password|passcode|\bpin\b|signature|initials?|certif(y|ication)|attest|agree(?:ment)?|alien\s*(number|registration)|passport|driver.?s?\s*licen[cs]e|document\s*(number|id)|full\s*date\s*of\s*birth|\bdob\b|race|racial|ethnic|hispanic|\bsex\b|gender|religion|national\s*origin|marital\s*status/i;

  function visible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function normalizedText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function redactPageText(value) {
    return normalizedText(value)
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[sensitive number removed]")
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, "[account number removed]")
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]")
      .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone removed]")
      .replace(/\b\d{1,5}\s+[A-Za-z0-9.' -]+\s(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Boulevard|Blvd)\b\.?/gi, "[address removed]");
  }

  function openRoots(root = document) {
    const roots = [];
    const visit = (currentRoot) => {
      roots.push(currentRoot);
      currentRoot.querySelectorAll("*").forEach((element) => {
        if (element.shadowRoot) visit(element.shadowRoot);
      });
    };
    visit(root);
    return roots;
  }

  function controlsInOpenRoots(root = document) {
    const controls = [];
    openRoots(root).forEach((currentRoot) => {
      controls.push(...currentRoot.querySelectorAll("input, select, textarea"));
    });
    return [...new Set(controls)];
  }

  function labelFor(element) {
    const labels = element.labels ? [...element.labels].map((label) => label.innerText) : [];
    const closestLabel = element.closest("label")?.innerText;
    const fieldset = element.closest("fieldset")?.querySelector("legend")?.innerText;
    const formElement = element.closest(".slds-form-element, lightning-input, lightning-combobox, lightning-textarea, [data-field]");
    const salesforceLabel = formElement?.querySelector(".slds-form-element__label, label, legend")?.textContent;
    const nearbyLabel = element.parentElement?.previousElementSibling?.textContent;
    return normalizedText(
      element.getAttribute("aria-label")
      || element.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => document.getElementById(id)?.innerText).filter(Boolean).join(" ")
      || labels.join(" ")
      || closestLabel
      || salesforceLabel
      || nearbyLabel
      || element.getAttribute("title")
      || element.getAttribute("placeholder")
      || fieldset
      || element.getAttribute("name")
      || element.id
      || "Unlabeled field",
    ).slice(0, 240);
  }

  function isSensitive(element, label) {
    const description = [
      label,
      element.getAttribute("name"),
      element.id,
      element.getAttribute("autocomplete"),
      element.getAttribute("placeholder"),
      element.getAttribute("type"),
    ].filter(Boolean).join(" ");
    return element.type === "password" || sensitivePattern.test(description);
  }

  function pageSummary() {
    let pageUrl = "";
    let formAction = "";
    try {
      const url = new URL(window.location.href);
      pageUrl = `${url.origin}${url.pathname}`;
      const action = document.querySelector("form")?.action;
      if (action) {
        const actionUrl = new URL(action, window.location.href);
        formAction = `${actionUrl.origin}${actionUrl.pathname}`;
      }
    } catch {
      pageUrl = "";
    }
    return { title: normalizedText(document.title).slice(0, 180), pageUrl, formAction };
  }

  function scanFields() {
    fieldMap.clear();
    const elements = controlsInOpenRoots()
      .filter((element) => !element.disabled && !element.readOnly && !blockedInputTypes.has(element.type) && visible(element));

    const fields = elements.slice(0, 120).map((element, index) => {
      const id = `field-${index + 1}`;
      const label = labelFor(element);
      const sensitive = isSensitive(element, label);
      fieldMap.set(id, element);
      const options = element instanceof HTMLSelectElement
        ? [...element.options].slice(0, 60).map((option) => ({ value: option.value.slice(0, 120), text: normalizedText(option.text).slice(0, 120) }))
        : [];
      return {
        id,
        label,
        tag: element.tagName.toLowerCase(),
        type: element.type || element.tagName.toLowerCase(),
        required: element.required || element.getAttribute("aria-required") === "true",
        autocomplete: normalizedText(element.getAttribute("autocomplete")).slice(0, 80),
        sensitive,
        hasValue: element.type === "checkbox" || element.type === "radio" ? element.checked : Boolean(element.value),
        options,
      };
    });

    return { ...pageSummary(), fields };
  }

  function capturePageContext() {
    const seen = new Set();
    const parts = [];
    let characterCount = 0;
    const selector = "h1, h2, h3, h4, p, li, dt, dd, legend, label, [role='heading'], [role='alert'], .slds-form-element__help, .slds-text-body_regular";

    for (const root of openRoots()) {
      for (const element of root.querySelectorAll(selector)) {
        if (!visible(element) || element.closest("script, style, noscript, template, svg, canvas")) continue;
        const text = redactPageText(element.innerText || element.textContent).slice(0, 1_200);
        if (text.length < 2 || seen.has(text)) continue;
        seen.add(text);
        if (characterCount + text.length > 16_000) break;
        parts.push(text);
        characterCount += text.length + 1;
      }
      if (characterCount >= 16_000) break;
    }

    const fieldLabels = controlsInOpenRoots()
      .filter((element) => !blockedInputTypes.has(element.type) && visible(element))
      .slice(0, 100)
      .flatMap((element) => {
        const label = redactPageText(labelFor(element)).slice(0, 240);
        return label && !isSensitive(element, label)
          ? [{ label, type: String(element.type || element.tagName).slice(0, 40), required: element.required || element.getAttribute("aria-required") === "true" }]
          : [];
      });

    return {
      ...pageSummary(),
      content: parts.join("\n").slice(0, 16_000),
      fieldLabels,
      capturedAt: new Date().toISOString(),
    };
  }

  function highlightField(id) {
    const element = fieldMap.get(id);
    if (!element) return { ok: false, error: "Field not found. Scan the page again." };
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    const previousOutline = element.style.outline;
    const previousOffset = element.style.outlineOffset;
    element.style.outline = "4px solid #ef7054";
    element.style.outlineOffset = "4px";
    element.focus({ preventScroll: true });
    window.setTimeout(() => {
      element.style.outline = previousOutline;
      element.style.outlineOffset = previousOffset;
    }, 3500);
    return { ok: true };
  }

  function fillField(id, rawValue, shouldHighlight = true) {
    const element = fieldMap.get(id);
    if (!element) return { ok: false, error: "Field not found. Scan the page again." };
    const label = labelFor(element);
    if (isSensitive(element, label)) return { ok: false, error: "BenefitBeacon never fills sensitive identifiers." };
    const value = normalizedText(rawValue).slice(0, 300);
    if (!value) return { ok: false, error: "No suggested value is available." };

    if (element instanceof HTMLSelectElement) {
      const target = [...element.options].find((option) => {
        const optionValue = normalizedText(option.value).toLowerCase();
        const optionText = normalizedText(option.text).toLowerCase();
        return optionValue === value.toLowerCase() || optionText === value.toLowerCase();
      });
      if (!target) return { ok: false, error: "The suggested value does not match an available option." };
      const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      selectSetter?.call(element, target.value);
    } else if (element.type === "checkbox" || element.type === "radio") {
      const checkedSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
      checkedSetter?.call(element, /^(yes|true|1|checked)$/i.test(value));
    } else if (element instanceof HTMLInputElement) {
      const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      inputSetter?.call(element, value);
    } else if (element instanceof HTMLTextAreaElement) {
      const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      textareaSetter?.call(element, value);
    } else {
      return { ok: false, error: "This field type is not supported." };
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    if (shouldHighlight) highlightField(id);
    return { ok: true };
  }

  function fillFields(items) {
    if (!Array.isArray(items) || !items.length || items.length > 80) return { ok: false, error: "No approved fields were provided." };
    const results = items.map((item) => {
      if (!item || typeof item.fieldId !== "string") return { ok: false, error: "Invalid field." };
      return { fieldId: item.fieldId, ...fillField(item.fieldId, item.value, false) };
    });
    return {
      ok: true,
      filled: results.filter((result) => result.ok).length,
      skipped: results.filter((result) => !result.ok).map((result) => ({ fieldId: result.fieldId, error: result.error })),
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "BENEFITBEACON_SCAN_FORM") {
      sendResponse({ ok: true, page: scanFields() });
      return false;
    }
    if (message?.type === "BENEFITBEACON_CAPTURE_CONTEXT") {
      sendResponse({ ok: true, context: capturePageContext() });
      return false;
    }
    if (message?.type === "BENEFITBEACON_HIGHLIGHT_FIELD") {
      sendResponse(highlightField(message.fieldId));
      return false;
    }
    if (message?.type === "BENEFITBEACON_FILL_FIELD") {
      sendResponse(fillField(message.fieldId, message.value));
      return false;
    }
    if (message?.type === "BENEFITBEACON_FILL_FIELDS") {
      sendResponse(fillFields(message.items));
      return false;
    }
    return false;
  });
})();
