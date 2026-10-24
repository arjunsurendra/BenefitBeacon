# Beacon Benefit browser extension

Beacon Benefit is a focused chat agent that stays beside an official application in Chrome or Microsoft Edge. The extension shows only a conversation and the **Ask while you apply** input. Residents can ask questions naturally or say **fill this page** to review AI-matched answers before filling.

## Install for the demo

1. Start BenefitBeacon at `http://localhost:3000`.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select this `extension` folder.
5. Pin **BenefitBeacon Application Guide** to the browser toolbar.

## Use it

1. Find a program in BenefitBeacon and choose **Apply with BenefitBeacon**.
2. The official application opens in a new tab and the selected program conversation is handed to the extension.
3. Select the **Beacon Benefit** toolbar icon to open the side panel. Beacon automatically reads the current page URL, visible instructions, headings, and safe field labels for context.
4. Ask a question in **Ask while you apply**, or type **fill this page**.
5. Beacon Benefit lists the fields it can fill from information already shared. Reply **fill them** to approve or **cancel** to leave the page unchanged.
6. Review the application page before saving or continuing.

The Silicon Valley Clean Energy Salesforce portal is supported because it exposes standard web form controls. Reload the unpacked extension after updating it, then reconnect on each application step so newly displayed fields can be scanned.

The extension uses the BenefitBeacon address stored during the application handoff. The default local address is `http://localhost:3000`.

## Safety boundaries

- Reads the current page URL without query parameters, visible application instructions, headings, and safe field labels so it can explain the page. It does not read or transmit values entered in form controls.
- Sends only empty, non-sensitive field labels and the resident's saved BenefitBeacon profile to the local BenefitBeacon server for AI matching.
- Never fills passwords, Social Security numbers, bank details, signatures, legal certifications, identity-document numbers, full birth dates, protected demographic fields, or file uploads.
- Never submits, signs, accepts terms, bypasses verification, or clicks through an application.
- Never overwrites a completed field. AI suggestions require confidence of at least 82 percent and one resident approval before bulk fill.
- Requests access only to the official site the resident chooses to connect.
- Stores the handoff, safe profile facts, settings, and recent program chat locally in the browser profile.
- Uses BenefitBeacon's existing `/api/program-chat` endpoint for sourced program guidance. The OpenAI API key remains on the server and is never packaged in the extension.

Some application forms embedded in protected cross-origin frames cannot be inspected. The side-panel chat and official page link remain available in that case.
