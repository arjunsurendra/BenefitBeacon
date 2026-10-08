"use client";

import { useEffect, useMemo, useState } from "react";
import { programs } from "@/data/programs";
import { extractLocally } from "@/lib/intake/local-extractor";
import { rankPrograms } from "@/lib/rules/engine";
import type { DiscoveryResponse, EligibilityResult, EligibilityStatus, IntakeResponse, UserProfile } from "@/lib/types";

type Language = "en" | "es" | "vi";
type View = "home" | "analyzing" | "followup" | "results";
type FollowUpAnswers = {
  location: string;
  ageRange: string;
  householdSize: string;
  incomeBand: string;
  housing: string;
  children: string;
  employment: string;
  veteran: string;
  activeDuty: string;
  disabled: string;
  caregiver: string;
  utilityBills: string;
  homeAgeYears: string;
  interests: string[];
};

const emptyFollowUps: FollowUpAnswers = {
  location: "", ageRange: "", householdSize: "", incomeBand: "", housing: "", children: "", employment: "", veteran: "", activeDuty: "", disabled: "", caregiver: "", utilityBills: "", homeAgeYears: "", interests: [],
};

const copy = {
  en: {
    navHow: "How it works", navPrivacy: "Privacy", heroKicker: "Local help, made easier", heroTitleA: "You may qualify for help", heroTitleB: "you didn’t know existed.",
    heroBody: "Tell us what’s going on once. BenefitBeacon can ask optional follow-ups, then checks verified programs and current official sources.", prompt: "Tell us about your situation", placeholder: "Example: I’m a retired veteran in Sunnyvale, renting with two kids. Energy bills have been hard to keep up with.", find: "Find my benefits",
    private: "Private by design", privateBody: "No account. No profile stored on our servers. Sensitive numbers are removed before any AI call.", rules: "Rules decide", rulesBody: "AI organizes what you tell us. A testable rules engine—not a chatbot—checks each verified program.", sources: "Live official sources", sourcesBody: "Your final list combines reviewed programs with relevant new findings from official agency websites.",
    scan: "Checking programs for you", scanBody: "Structuring your details, applying eligibility rules, and searching current official sources.", resultsFor: "Your most relevant benefits", possible: "programs worth exploring", likely: "Likely match", maybe: "Possible match", unlikely: "Unlikely", all: "All", why: "Why this matched", apply: "Visit official site", details: "See match details", verified: "Last verified", reminder: "Estimate only. Final eligibility is decided by each agency. This is not legal or financial advice.", share: "Share list", print: "Print / Save PDF", startOver: "Start over", close: "Close", trace: "Eligibility trace", evidence: "Source evidence", next: "Suggested next steps", askTitle: "Ask about these programs", askPlaceholder: "Can renters get energy-bill help?", ask: "Search evidence",
    followTitle: "A few optional questions can improve your matches", followBody: "Answer any that you are comfortable sharing. Every question can be left blank, and you can skip this step.", showResults: "Use these answers", skip: "Skip optional questions", optional: "Optional", liveTitle: "Relevant programs found live", liveBody: "Current programs from official sources, ranked against the details you chose to provide.", liveBadge: "Live finding · confirm eligibility", liveWhy: "Why this may be relevant", published: "Published eligibility", noLocation: "Live local search was skipped because no city or ZIP was provided.", liveUnavailable: "Live official-source search was unavailable. Your reviewed matches are still shown.",
  },
  es: {
    navHow: "Cómo funciona", navPrivacy: "Privacidad", heroKicker: "Ayuda local, más fácil", heroTitleA: "Puede calificar para ayuda", heroTitleB: "que no sabía que existía.", heroBody: "Cuéntenos su situación una vez. BenefitBeacon puede hacer preguntas opcionales y revisar fuentes oficiales actuales.", prompt: "Cuéntenos su situación", placeholder: "Ejemplo: Soy veterano jubilado en Sunnyvale, alquilo y tengo dos hijos. Es difícil pagar la energía.", find: "Buscar beneficios", private: "Privado por diseño", privateBody: "Sin cuenta. No guardamos su perfil. Quitamos números sensibles antes de usar IA.", rules: "Las reglas deciden", rulesBody: "La IA organiza sus datos. Un motor de reglas comprobable revisa cada programa.", sources: "Fuentes oficiales en vivo", sourcesBody: "La lista final combina programas revisados con hallazgos relevantes de agencias oficiales.", scan: "Revisando programas", scanBody: "Organizamos sus datos, aplicamos reglas y buscamos fuentes oficiales actuales.", resultsFor: "Sus beneficios más relevantes", possible: "programas para explorar", likely: "Probable", maybe: "Posible", unlikely: "Poco probable", all: "Todos", why: "Por qué coincide", apply: "Visitar sitio oficial", details: "Ver detalles", verified: "Verificado", reminder: "Solo una estimación. Cada agencia toma la decisión final.", share: "Compartir", print: "Imprimir / PDF", startOver: "Empezar de nuevo", close: "Cerrar", trace: "Rastro de elegibilidad", evidence: "Evidencia", next: "Próximos pasos", askTitle: "Pregunte sobre estos programas", askPlaceholder: "¿Hay ayuda de energía para inquilinos?", ask: "Buscar evidencia", followTitle: "Preguntas opcionales pueden mejorar los resultados", followBody: "Responda solo lo que quiera. Puede dejar cualquier pregunta vacía u omitir este paso.", showResults: "Usar estas respuestas", skip: "Omitir preguntas", optional: "Opcional", liveTitle: "Programas relevantes encontrados en vivo", liveBody: "Programas actuales de fuentes oficiales, ordenados según los datos que compartió.", liveBadge: "Hallazgo en vivo · confirme elegibilidad", liveWhy: "Por qué puede ser relevante", published: "Elegibilidad publicada", noLocation: "La búsqueda local se omitió porque no se indicó ciudad o código postal.", liveUnavailable: "La búsqueda en vivo no estuvo disponible. Sus resultados revisados se muestran abajo.",
  },
  vi: {
    navHow: "Cách hoạt động", navPrivacy: "Quyền riêng tư", heroKicker: "Hỗ trợ địa phương, dễ dàng hơn", heroTitleA: "Bạn có thể đủ điều kiện", heroTitleB: "cho hỗ trợ chưa từng biết.", heroBody: "Hãy kể hoàn cảnh một lần. BenefitBeacon có thể hỏi thêm tùy chọn rồi kiểm tra các nguồn chính thức hiện tại.", prompt: "Hãy kể hoàn cảnh của bạn", placeholder: "Ví dụ: Tôi là cựu chiến binh đã nghỉ hưu ở Sunnyvale, thuê nhà với hai con và khó trả hóa đơn điện.", find: "Tìm phúc lợi", private: "Riêng tư từ thiết kế", privateBody: "Không cần tài khoản. Không lưu hồ sơ. Số nhạy cảm được xóa trước khi gọi AI.", rules: "Quy tắc quyết định", rulesBody: "AI sắp xếp thông tin. Bộ quy tắc kiểm tra từng chương trình.", sources: "Nguồn chính thức trực tiếp", sourcesBody: "Danh sách cuối kết hợp chương trình đã duyệt và kết quả mới từ trang cơ quan chính thức.", scan: "Đang kiểm tra chương trình", scanBody: "Sắp xếp thông tin, áp dụng quy tắc và tìm nguồn chính thức hiện tại.", resultsFor: "Quyền lợi phù hợp nhất", possible: "chương trình đáng tìm hiểu", likely: "Có khả năng", maybe: "Có thể", unlikely: "Ít khả năng", all: "Tất cả", why: "Vì sao phù hợp", apply: "Trang chính thức", details: "Xem chi tiết", verified: "Xác minh", reminder: "Chỉ là ước tính. Cơ quan sẽ quyết định điều kiện cuối cùng.", share: "Chia sẻ", print: "In / PDF", startOver: "Bắt đầu lại", close: "Đóng", trace: "Dấu vết điều kiện", evidence: "Bằng chứng", next: "Bước tiếp theo", askTitle: "Hỏi về chương trình", askPlaceholder: "Người thuê có được hỗ trợ điện không?", ask: "Tìm bằng chứng", followTitle: "Một vài câu hỏi tùy chọn giúp cải thiện kết quả", followBody: "Chỉ trả lời điều bạn muốn. Có thể để trống hoặc bỏ qua toàn bộ bước này.", showResults: "Dùng câu trả lời", skip: "Bỏ qua câu hỏi", optional: "Tùy chọn", liveTitle: "Chương trình phù hợp tìm thấy trực tiếp", liveBody: "Chương trình hiện tại từ nguồn chính thức, xếp theo thông tin bạn đã chia sẻ.", liveBadge: "Kết quả trực tiếp · hãy xác nhận điều kiện", liveWhy: "Vì sao có thể phù hợp", published: "Điều kiện đã công bố", noLocation: "Đã bỏ qua tìm kiếm địa phương vì chưa có thành phố hoặc ZIP.", liveUnavailable: "Không thể tìm trực tiếp lúc này. Kết quả đã duyệt vẫn hiển thị bên dưới.",
  },
} as const;

function statusLabel(status: EligibilityStatus, t: (typeof copy)[Language]) { return status === "likely" ? t.likely : status === "maybe" ? t.maybe : t.unlikely; }

function profileLabel(field: string, value: unknown) {
  const labels: Record<string, string> = { city: "Location", zip: "ZIP", ageRange: "Age", householdSize: "Household", childrenAges: "Children", incomeBand: "Income", housing: "Housing", veteran: "Veteran", activeDuty: "Active duty", disabled: "Disability", caregiver: "Caregiver", employment: "Work", hasHighWaterBill: "Utility pressure", interests: "Needs" };
  const display = Array.isArray(value) ? value.length ? value.join(", ") : "None" : value === true ? "Yes" : value === false ? "No" : String(value).replaceAll("k", "K");
  return `${labels[field] ?? field}: ${display}`;
}

function sourceSearch(question: string, results: EligibilityResult[]) {
  const terms = question.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
  return results.map((result) => ({ result, points: terms.reduce((score, term) => score + (`${result.program.name} ${result.program.summary} ${result.program.sourceSnippet} ${result.program.category}`.toLowerCase().includes(term) ? 1 : 0), 0) })).sort((a, b) => b.points - a.points)[0]?.result;
}

function booleanAnswer(value: string): boolean | undefined { return value === "yes" ? true : value === "no" ? false : undefined; }

function withFollowUps(base: UserProfile, answers: FollowUpAnswers): UserProfile {
  const next = { ...base };
  const location = answers.location.trim();
  if (location) {
    const zip = location.match(/\b\d{5}\b/)?.[0];
    if (zip) next.zip = zip;
    const city = location.split(",")[0].replace(/\d{5}.*/, "").trim();
    if (city && !/^\d+$/.test(city)) next.city = city.toLowerCase();
    next.state = location.match(/\b[A-Za-z]{2}\b/)?.[0]?.toUpperCase() ?? next.state ?? "CA";
  }
  if (answers.ageRange) next.ageRange = answers.ageRange as UserProfile["ageRange"];
  if (answers.householdSize) next.householdSize = Number(answers.householdSize);
  if (answers.incomeBand) next.incomeBand = answers.incomeBand as UserProfile["incomeBand"];
  if (answers.housing) next.housing = answers.housing as UserProfile["housing"];
  if (answers.children) next.childrenAges = answers.children === "none" ? [] : answers.children === "young" ? [3] : answers.children === "school" ? [8] : [3, 8];
  if (answers.employment) next.employment = answers.employment as UserProfile["employment"];
  for (const [field, value] of [["veteran", answers.veteran], ["activeDuty", answers.activeDuty], ["disabled", answers.disabled], ["caregiver", answers.caregiver], ["hasHighWaterBill", answers.utilityBills]] as const) {
    const parsed = booleanAnswer(value); if (parsed !== undefined) next[field] = parsed;
  }
  if (answers.homeAgeYears) next.homeAgeYears = Number(answers.homeAgeYears);
  if (answers.interests.length) next.interests = answers.interests;
  return next;
}

function missingQuestionCount(profile: UserProfile) {
  return [!profile.city, profile.ageRange === undefined, profile.householdSize === undefined, profile.incomeBand === undefined, profile.housing === undefined, profile.childrenAges === undefined, profile.employment === undefined, profile.veteran === undefined, profile.activeDuty === undefined, profile.disabled === undefined, profile.caregiver === undefined, profile.hasHighWaterBill === undefined, profile.interests === undefined].filter(Boolean).length;
}

export function BenefitBeaconApp() {
  const [language, setLanguage] = useState<Language>("en");
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<UserProfile>({});
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpAnswers>(emptyFollowUps);
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [discoveryNote, setDiscoveryNote] = useState("");
  const [scanPhase, setScanPhase] = useState("Understanding your situation");
  const [filter, setFilter] = useState<"all" | EligibilityStatus>("all");
  const [selected, setSelected] = useState<EligibilityResult | null>(null);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<EligibilityResult | null>(null);
  const t = copy[language];

  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined); }, []);

  const results = useMemo(() => rankPrograms(profile, programs), [profile]);
  const visibleResults = results.filter((result) => filter === "all" ? result.status !== "unlikely" : result.status === filter);
  const matchedCount = results.filter((result) => result.status !== "unlikely").length + (discovery?.candidates.length ?? 0);

  async function finalizeResults(finalProfile: UserProfile, response: IntakeResponse) {
    setProfile(finalProfile);
    setScanPhase("Searching current official sources");
    setView("analyzing");
    setDiscovery(null);
    setDiscoveryNote("");
    const location = finalProfile.city ? [finalProfile.city, finalProfile.state].filter(Boolean).join(", ") : finalProfile.zip ?? "";
    if (location) {
      try {
        const apiResponse = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location, profile: finalProfile }) });
        const payload = await apiResponse.json() as DiscoveryResponse | { error?: string };
        if (apiResponse.ok && "geography" in payload) setDiscovery(payload);
        else setDiscoveryNote("error" in payload && payload.error ? payload.error : t.liveUnavailable);
      } catch { setDiscoveryNote(t.liveUnavailable); }
    } else setDiscoveryNote(t.noLocation);
    sessionStorage.setItem("benefitbeacon-session", JSON.stringify({ profile: finalProfile, query, intake: response }));
    setView("results");
  }

  async function analyze(text: string) {
    const clean = text.trim();
    if (clean.length < 8) return;
    setScanPhase("Understanding your situation");
    setView("analyzing");
    let response: IntakeResponse;
    const local = extractLocally(clean);
    response = { profile: local.profile, confidence: local.confidence, followUpQuestions: [], mode: "local", redacted: false };
    try {
      const apiResponse = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean }) });
      if (apiResponse.ok) response = await apiResponse.json() as IntakeResponse;
    } catch { /* the local extractor is the intentional fallback */ }
    setProfile(response.profile);
    setIntake(response);
    if (missingQuestionCount(response.profile) > 0) setView("followup");
    else await finalizeResults(response.profile, response);
  }

  function submitFollowUps(event: React.FormEvent) {
    event.preventDefault();
    if (!intake) return;
    void finalizeResults(withFollowUps(profile, followUps), intake);
  }

  async function shareList() {
    const curated = results.filter((result) => result.status !== "unlikely").map((result) => `${result.program.name} — ${statusLabel(result.status, t)}\n${result.program.applyUrl}`);
    const live = (discovery?.candidates ?? []).map((program) => `${program.name} — ${t.liveBadge}\n${program.applyUrl}`);
    const text = [...curated, ...live].join("\n\n");
    if (navigator.share) await navigator.share({ title: "My BenefitBeacon list", text }); else await navigator.clipboard.writeText(text);
  }

  function reset() {
    sessionStorage.removeItem("benefitbeacon-session");
    setQuery(""); setProfile({}); setIntake(null); setFollowUps(emptyFollowUps); setDiscovery(null); setDiscoveryNote(""); setView("home"); setAnswer(null);
  }

  function setFollowUp(field: keyof FollowUpAnswers, value: string | string[]) { setFollowUps((current) => ({ ...current, [field]: value })); }
  function toggleInterest(value: string) { setFollowUps((current) => ({ ...current, interests: current.interests.includes(value) ? current.interests.filter((item) => item !== value) : [...current.interests, value] })); }

  const select = (label: string, field: keyof FollowUpAnswers, options: Array<[string, string]>) => (
    <label>{label}<span>{t.optional}</span><select value={followUps[field] as string} onChange={(event) => setFollowUp(field, event.target.value)}><option value="">Prefer not to answer</option>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>
  );
  const yesNo = (label: string, field: keyof FollowUpAnswers) => select(label, field, [["yes", "Yes"], ["no", "No"]]);
  const shellClass = `app-shell ${largeText ? "large-text" : ""} ${highContrast ? "high-contrast" : ""}`;

  return (
    <main className={shellClass}>
      <header className="site-header">
        <button className="brand" onClick={reset} aria-label="BenefitBeacon home"><span className="brand-mark">BB</span><span>BenefitBeacon</span></button>
        <nav aria-label="Main navigation"><a href="#how">{t.navHow}</a><a href="#privacy">{t.navPrivacy}</a></nav>
        <div className="header-tools"><button className="utility-button" onClick={() => setLargeText((value) => !value)} aria-pressed={largeText}>A<span>A</span></button><button className="utility-button contrast-button" onClick={() => setHighContrast((value) => !value)} aria-pressed={highContrast} aria-label="Toggle high contrast">◐</button><label className="language-select"><span className="sr-only">Language</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">EN</option><option value="es">ES</option><option value="vi">VI</option></select></label></div>
      </header>

      {view === "home" && <>
        <section className="hero-section">
          <div className="hero-copy"><p className="eyebrow"><span>✦</span>{t.heroKicker}</p><h1>{t.heroTitleA}<br /><em>{t.heroTitleB}</em></h1><p className="hero-body">{t.heroBody}</p><div className="trust-line"><span>● No account</span><span>● Optional follow-ups</span><span>● Live official sources</span></div></div>
          <form className="intake-card" onSubmit={(event) => { event.preventDefault(); void analyze(query); }}>
            <div className="card-topline"><label htmlFor="situation">{t.prompt}</label><span className="ai-badge">✦ AI-assisted</span></div>
            <div className="textarea-wrap"><textarea id="situation" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder} rows={7} maxLength={2000} /></div>
            <div className="example-row"><span>Share only what you are comfortable sharing</span><span>{query.length}/2000</span></div>
            <button className="primary-button" type="submit" disabled={query.trim().length < 8}>{t.find}<span>→</span></button>
            <p className="micro-privacy"><span>⌾</span> Never enter an SSN, account number, or document number.</p>
          </form>
        </section>
        <section className="principles" id="how"><article><span className="number">01</span><div><h2>{t.private}</h2><p>{t.privateBody}</p></div></article><article><span className="number">02</span><div><h2>{t.rules}</h2><p>{t.rulesBody}</p></div></article><article><span className="number">03</span><div><h2>{t.sources}</h2><p>{t.sourcesBody}</p></div></article></section>
        <section className="architecture-strip" id="privacy"><span>YOUR STORY</span><b>→</b><span className="accent-step">OPTIONAL FOLLOW-UPS</span><b>→</b><span>RULES + LIVE SEARCH</span><b>→</b><span>RELEVANT OFFICIAL RESULTS</span></section>
      </>}

      {view === "analyzing" && <section className="analyzing-screen" aria-live="polite"><div className="scan-orbit"><span>✦</span></div><p className="eyebrow">BenefitBeacon engine</p><h1>{t.scan}</h1><p>{t.scanBody}</p><div className="scan-steps"><span className="done">✓ Sensitive data screened</span><span className="done">✓ Facts structured</span><span className="active">{scanPhase}</span></div></section>}

      {view === "followup" && <section className="followup-page">
        <div className="followup-heading"><p className="eyebrow"><span>✦</span>Better matching</p><h1>{t.followTitle}</h1><p>{t.followBody}</p><div className="followup-progress"><b>{missingQuestionCount(profile)}</b><span>useful details were not in your original description</span></div></div>
        <form className="followup-form" onSubmit={submitFollowUps}>
          <div className="followup-grid">
            {!profile.city && <label className="wide-field">City and state, or ZIP code<span>{t.optional}</span><input value={followUps.location} onChange={(event) => setFollowUp("location", event.target.value)} placeholder={profile.zip ? `City for ZIP ${profile.zip}` : "Sunnyvale, CA or 94087"} /></label>}
            {profile.ageRange === undefined && select("Your age range", "ageRange", [["under18", "Under 18"], ["18-24", "18–24"], ["25-54", "25–54"], ["55-61", "55–61"], ["62-64", "62–64"], ["65plus", "65 or older"]])}
            {profile.householdSize === undefined && <label>People in your household<span>{t.optional}</span><input type="number" min="1" max="30" value={followUps.householdSize} onChange={(event) => setFollowUp("householdSize", event.target.value)} placeholder="e.g. 3" /></label>}
            {profile.incomeBand === undefined && select("Annual household income", "incomeBand", [["under25k", "Under $25K"], ["25-50k", "$25K–$50K"], ["50-80k", "$50K–$80K"], ["80-120k", "$80K–$120K"], ["over120k", "Over $120K"]])}
            {profile.housing === undefined && select("Housing situation", "housing", [["rent", "Rent"], ["own", "Own"], ["unhoused", "No stable housing"], ["other", "Other"]])}
            {profile.childrenAges === undefined && select("Children in your care", "children", [["none", "None"], ["young", "Under age 5"], ["school", "School age"], ["both", "Both age groups"]])}
            {profile.employment === undefined && select("Current work situation", "employment", [["employed", "Employed"], ["unemployed", "Unemployed"], ["retired", "Retired"], ["student", "Student"], ["other", "Other"]])}
            {profile.veteran === undefined && yesNo("Veteran or military connection", "veteran")}
            {profile.activeDuty === undefined && yesNo("Currently serving on active duty", "activeDuty")}
            {profile.disabled === undefined && yesNo("Living with a disability", "disabled")}
            {profile.caregiver === undefined && yesNo("Providing unpaid care", "caregiver")}
            {profile.hasHighWaterBill === undefined && yesNo("Struggling with utility bills", "utilityBills")}
            {(profile.housing === "own" || followUps.housing === "own") && profile.homeAgeYears === undefined && <label>Approximate age of your home<span>{t.optional}</span><input type="number" min="0" max="250" value={followUps.homeAgeYears} onChange={(event) => setFollowUp("homeAgeYears", event.target.value)} placeholder="Years" /></label>}
            {profile.interests === undefined && <fieldset className="interest-field wide-field"><legend>What kind of help would be useful? <span>{t.optional}</span></legend><div>{[["food", "Food"], ["health", "Health care"], ["housing", "Housing"], ["utilities", "Utilities"], ["childcare", "Child care"], ["transportation", "Transportation"], ["home repair", "Home repair"], ["employment", "Work"]].map(([value, label]) => <label key={value}><input type="checkbox" checked={followUps.interests.includes(value)} onChange={() => toggleInterest(value)} />{label}</label>)}</div></fieldset>}
          </div>
          <div className="followup-actions"><button className="primary-button" type="submit">{t.showResults}<span>→</span></button><button className="skip-button" type="button" onClick={() => intake && void finalizeResults(profile, intake)}>{t.skip}</button></div>
        </form>
      </section>}

      {view === "results" && <section className="results-page">
        <div className="results-hero"><div><p className="eyebrow"><span>✦</span>{intake?.mode === "openai" ? `AI intake · ${intake.model}` : "Private local intake"}</p><h1>{t.resultsFor}</h1><p><strong>{matchedCount}</strong> {t.possible}</p></div><div className="result-actions"><button onClick={() => void shareList()}>{t.share}</button><button onClick={() => window.print()}>{t.print}</button><button onClick={reset}>{t.startOver}</button></div></div>
        <div className="profile-summary" aria-label="Extracted profile"><div className="profile-title"><span>AI</span><div><strong>What we understood</strong><small>{Math.round((intake?.confidence ?? 0) * 100)}% extraction confidence</small></div></div><div className="profile-chips">{Object.entries(profile).filter(([key]) => !["state", "homeAgeYears", "language"].includes(key)).map(([key, value]) => <span key={key}>{profileLabel(key, value)}</span>)}</div></div>

        <section className="live-results-section">
          <div className="live-results-heading"><div><p className="eyebrow"><span>⌁</span>Live official-source search</p><h2>{t.liveTitle}</h2><p>{t.liveBody}</p></div>{discovery && <span>{discovery.candidates.length} live results · {discovery.cached ? "cached research" : discovery.model}</span>}</div>
          {discoveryNote && <p className="live-note">ⓘ {discoveryNote}</p>}
          {discovery && discovery.candidates.length === 0 && <p className="live-note">No additional relevant programs were supported by the official sources searched.</p>}
          {discovery && discovery.candidates.length > 0 && <div className="discovered-grid">{discovery.candidates.map((program) => <article className="discovered-card" key={program.id}><div className="discovered-meta"><span>{t.liveBadge}</span><b>{program.level} · {program.category}</b></div><h3>{program.name}</h3><p className="discovered-benefit">{program.benefit}</p><p>{program.summary}</p><div className="why-box live-why"><strong>{t.liveWhy}</strong><p>{program.relevanceReason}</p></div><div className="published-eligibility"><strong>{t.published}</strong><p>{program.eligibilityText}</p></div><div className="discovered-actions"><a href={program.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a><a href={program.applyUrl} target="_blank" rel="noreferrer">{t.apply} ↗</a></div></article>)}</div>}
        </section>

        <div className="results-layout"><aside className="filter-panel"><p>REVIEWED MATCHES</p>{(["all", "likely", "maybe", "unlikely"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}><span>{item === "all" ? t.all : statusLabel(item, t)}</span><b>{item === "all" ? results.length : results.filter((result) => result.status === item).length}</b></button>)}<div className="rule-note"><span>◇</span><p><strong>AI finds.<br />Rules decide.</strong><br />Reviewed matches include an auditable trace. Live findings always require confirmation.</p></div></aside>
          <div className="results-list"><div className="list-heading"><h2>Reviewed programs</h2><span>{visibleResults.length} programs</span></div>{visibleResults.map((result) => <article className={`program-card ${result.status}`} key={result.program.id}><div className="program-card-main"><div className="program-meta"><span className={`status ${result.status}`}>{result.status === "likely" ? "✓" : result.status === "maybe" ? "?" : "–"} {statusLabel(result.status, t)}</span><span>{result.program.level} · {result.program.category}</span></div><h3>{result.program.name}</h3><p className="benefit-line">{result.program.benefit}</p><div className="why-box"><strong>{t.why}</strong><p>{result.matchedRules.length ? result.matchedRules.slice(0, 2).join(". ") + "." : "More information is needed before the rules can make a strong match."}</p></div><div className="card-footer"><span>● {t.verified}: {result.program.lastVerified}</span><span>↗ {result.program.sourceLabel}</span></div></div><div className="program-card-actions"><button onClick={() => setSelected(result)}>{t.details}</button><a href={result.program.applyUrl} target="_blank" rel="noreferrer">{t.apply}<span>↗</span></a></div></article>)}
            <section className="ask-card"><div><p className="eyebrow"><span>✦</span>Grounded retrieval</p><h2>{t.askTitle}</h2><p>Searches only the official evidence attached to reviewed results.</p></div><form onSubmit={(event) => { event.preventDefault(); setAnswer(sourceSearch(question, results)); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t.askPlaceholder} /><button type="submit">{t.ask}</button></form>{answer && <div className="answer-box"><strong>{answer.program.name}</strong><p>{answer.program.sourceSnippet}</p><a href={answer.program.sourceUrl} target="_blank" rel="noreferrer">{answer.program.sourceLabel} ↗</a></div>}</section>
          </div>
        </div><div className="disclaimer">ⓘ {t.reminder}</div>
      </section>}

      <footer><span>BenefitBeacon · CA-17</span><p>Built for clarity, privacy, and local impact.</p><a href="mailto:benefitbeacon@example.org">Report an error ↗</a></footer>
      {selected && <div className="modal-backdrop detail-backdrop" onMouseDown={() => setSelected(null)}><aside className="detail-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)} aria-label={t.close}>×</button><div className="program-meta"><span className={`status ${selected.status}`}>{statusLabel(selected.status, t)}</span><span>{selected.program.jurisdiction}</span></div><h2>{selected.program.name}</h2><p className="drawer-summary">{selected.program.summary}</p><section><h3>{t.trace}</h3><div className="trace-list">{selected.matchedRules.map((rule) => <p key={rule}><span>✓</span>{rule}</p>)}{selected.missingInfo.map((field) => <p className="missing" key={field}><span>?</span>Need information: {field}</p>)}</div></section><section><h3>{t.evidence}</h3><blockquote>“{selected.program.sourceSnippet}”</blockquote><a href={selected.program.sourceUrl} target="_blank" rel="noreferrer">{selected.program.sourceLabel} ↗</a></section><section><h3>{t.next}</h3><ol>{selected.program.steps.map((step) => <li key={step}>{step}</li>)}</ol></section><p className="drawer-disclaimer">{t.reminder}</p><a className="primary-button apply-link" href={selected.program.applyUrl} target="_blank" rel="noreferrer">{t.apply}<span>↗</span></a></aside></div>}
    </main>
  );
}
