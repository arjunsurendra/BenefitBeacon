"use client";

import { useEffect, useMemo, useState } from "react";
import { programs } from "@/data/programs";
import { extractLocally } from "@/lib/intake/local-extractor";
import { rankPrograms, topFollowUpQuestions } from "@/lib/rules/engine";
import type { EligibilityResult, EligibilityStatus, IntakeResponse, UserProfile } from "@/lib/types";

type Language = "en" | "es" | "vi";
type View = "home" | "analyzing" | "results";

const copy = {
  en: {
    navHow: "How it works",
    navPrivacy: "Privacy",
    heroKicker: "Local help, made easier",
    heroTitleA: "You may qualify for help",
    heroTitleB: "you didn’t know existed.",
    heroBody: "Tell us what’s going on. BenefitFinder checks verified local, state, and federal programs—then explains each match in plain language.",
    prompt: "Tell us about your situation",
    placeholder: "Example: I’m a retired veteran in Sunnyvale, renting with two kids. Energy bills have been hard to keep up with.",
    find: "Find my benefits",
    guided: "Use guided questions instead",
    private: "Private by design",
    privateBody: "No account. No profile stored on our servers. Sensitive numbers are removed before any AI call.",
    rules: "Rules decide",
    rulesBody: "AI organizes what you tell us. A testable rules engine—not a chatbot—checks each program.",
    sources: "Official sources",
    sourcesBody: "Every match includes an agency link, source evidence, and the date we last checked it.",
    scan: "Checking programs for you",
    scanBody: "Structuring your details, applying eligibility rules, and grounding each match in official sources.",
    resultsFor: "Your matches",
    possible: "programs worth exploring",
    likely: "Likely match",
    maybe: "Possible match",
    unlikely: "Unlikely",
    all: "All",
    why: "Why this matched",
    apply: "Visit official site",
    details: "See match details",
    verified: "Last verified",
    official: "Official source",
    reminder: "Estimate only. Final eligibility is decided by each agency. This is not legal or financial advice.",
    share: "Share list",
    print: "Print / Save PDF",
    startOver: "Start over",
    guidedTitle: "A few simple questions",
    guidedBody: "Choose broad ranges. Exact income, SSNs, and document numbers are never needed.",
    continue: "Check my answers",
    close: "Close",
    trace: "Eligibility trace",
    evidence: "Source evidence",
    next: "Suggested next steps",
    askTitle: "Ask about these programs",
    askPlaceholder: "Can renters get energy-bill help?",
    ask: "Search evidence",
  },
  es: {
    navHow: "Cómo funciona", navPrivacy: "Privacidad", heroKicker: "Ayuda local, más fácil", heroTitleA: "Puede calificar para ayuda", heroTitleB: "que no sabía que existía.",
    heroBody: "Cuéntenos su situación. BenefitFinder revisa programas locales, estatales y federales verificados y explica cada resultado con palabras sencillas.", prompt: "Cuéntenos su situación", placeholder: "Ejemplo: Soy veterano jubilado en Sunnyvale, alquilo y tengo dos hijos. Es difícil pagar la energía.", find: "Buscar beneficios", guided: "Usar preguntas guiadas", private: "Privado por diseño", privateBody: "Sin cuenta. No guardamos su perfil. Quitamos números sensibles antes de usar IA.", rules: "Las reglas deciden", rulesBody: "La IA organiza sus datos. Un motor de reglas comprobable revisa cada programa.", sources: "Fuentes oficiales", sourcesBody: "Cada resultado incluye un enlace oficial, evidencia y la fecha de verificación.", scan: "Revisando programas", scanBody: "Organizamos sus datos, aplicamos reglas y verificamos cada resultado con fuentes oficiales.", resultsFor: "Sus resultados", possible: "programas para explorar", likely: "Probable", maybe: "Posible", unlikely: "Poco probable", all: "Todos", why: "Por qué coincide", apply: "Visitar sitio oficial", details: "Ver detalles", verified: "Verificado", official: "Fuente oficial", reminder: "Solo una estimación. Cada agencia toma la decisión final. No es asesoría legal ni financiera.", share: "Compartir lista", print: "Imprimir / Guardar PDF", startOver: "Empezar de nuevo", guidedTitle: "Unas preguntas simples", guidedBody: "Elija rangos generales. Nunca pedimos ingreso exacto, SSN ni números de documentos.", continue: "Revisar respuestas", close: "Cerrar", trace: "Rastro de elegibilidad", evidence: "Evidencia de la fuente", next: "Próximos pasos", askTitle: "Pregunte sobre estos programas", askPlaceholder: "¿Los inquilinos pueden recibir ayuda de energía?", ask: "Buscar evidencia",
  },
  vi: {
    navHow: "Cách hoạt động", navPrivacy: "Quyền riêng tư", heroKicker: "Hỗ trợ địa phương, dễ dàng hơn", heroTitleA: "Bạn có thể đủ điều kiện", heroTitleB: "cho hỗ trợ chưa từng biết.",
    heroBody: "Hãy kể hoàn cảnh của bạn. BenefitFinder kiểm tra các chương trình địa phương, tiểu bang và liên bang đã xác minh rồi giải thích bằng ngôn ngữ dễ hiểu.", prompt: "Hãy kể hoàn cảnh của bạn", placeholder: "Ví dụ: Tôi là cựu chiến binh đã nghỉ hưu ở Sunnyvale, thuê nhà với hai con và khó trả hóa đơn điện.", find: "Tìm phúc lợi", guided: "Dùng câu hỏi hướng dẫn", private: "Riêng tư từ thiết kế", privateBody: "Không cần tài khoản. Không lưu hồ sơ trên máy chủ. Số nhạy cảm được xóa trước khi gọi AI.", rules: "Quy tắc quyết định", rulesBody: "AI sắp xếp thông tin. Một bộ quy tắc có thể kiểm tra sẽ xét từng chương trình.", sources: "Nguồn chính thức", sourcesBody: "Mỗi kết quả có liên kết cơ quan, bằng chứng và ngày xác minh.", scan: "Đang kiểm tra chương trình", scanBody: "Sắp xếp thông tin, áp dụng quy tắc và đối chiếu nguồn chính thức.", resultsFor: "Kết quả của bạn", possible: "chương trình đáng tìm hiểu", likely: "Có khả năng", maybe: "Có thể", unlikely: "Ít khả năng", all: "Tất cả", why: "Vì sao phù hợp", apply: "Trang chính thức", details: "Xem chi tiết", verified: "Xác minh", official: "Nguồn chính thức", reminder: "Chỉ là ước tính. Cơ quan sẽ quyết định điều kiện cuối cùng. Đây không phải tư vấn pháp lý hoặc tài chính.", share: "Chia sẻ", print: "In / Lưu PDF", startOver: "Bắt đầu lại", guidedTitle: "Một vài câu hỏi đơn giản", guidedBody: "Chọn khoảng rộng. Không cần thu nhập chính xác, SSN hay số giấy tờ.", continue: "Kiểm tra câu trả lời", close: "Đóng", trace: "Dấu vết điều kiện", evidence: "Bằng chứng nguồn", next: "Bước tiếp theo", askTitle: "Hỏi về các chương trình", askPlaceholder: "Người thuê nhà có được hỗ trợ hóa đơn điện không?", ask: "Tìm bằng chứng",
  },
} as const;

const demoText = "I’m a 68-year-old retired veteran in Sunnyvale. I rent with two grandchildren, ages 4 and 9. Our household income is about $38,000 and utility bills are getting hard to manage.";

function statusLabel(status: EligibilityStatus, t: (typeof copy)[Language]) {
  return status === "likely" ? t.likely : status === "maybe" ? t.maybe : t.unlikely;
}

function profileLabel(field: string, value: unknown) {
  const labels: Record<string, string> = { city: "Location", ageRange: "Age", householdSize: "Household", childrenAges: "Children", incomeBand: "Income", housing: "Housing", veteran: "Veteran", disabled: "Disability", employment: "Work" };
  const display = Array.isArray(value) ? value.join(", ") : value === true ? "Yes" : value === false ? "No" : String(value).replaceAll("k", "K");
  return `${labels[field] ?? field}: ${display}`;
}

function sourceSearch(question: string, results: EligibilityResult[]) {
  const terms = question.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
  return results
    .map((result) => ({ result, points: terms.reduce((score, term) => score + (`${result.program.name} ${result.program.summary} ${result.program.sourceSnippet} ${result.program.category}`.toLowerCase().includes(term) ? 1 : 0), 0) }))
    .sort((a, b) => b.points - a.points)[0]?.result;
}

export function BenefitFinderApp() {
  const [language, setLanguage] = useState<Language>("en");
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<UserProfile>({});
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [filter, setFilter] = useState<"all" | EligibilityStatus>("all");
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [selected, setSelected] = useState<EligibilityResult | null>(null);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [listening, setListening] = useState(false);
  const [guided, setGuided] = useState({ city: "sunnyvale", incomeBand: "25-50k", housing: "rent", children: "school", veteran: false, bills: true });
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<EligibilityResult | null>(null);
  const t = copy[language];

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const results = useMemo(() => rankPrograms(profile, programs), [profile]);
  const visibleResults = results.filter((result) => filter === "all" ? result.status !== "unlikely" : result.status === filter);
  const matchedCount = results.filter((result) => result.status !== "unlikely").length;
  const followUps = useMemo(() => topFollowUpQuestions(results), [results]);

  async function analyze(text: string, providedProfile?: UserProfile) {
    const clean = text.trim();
    if (!providedProfile && clean.length < 8) return;
    setView("analyzing");
    setGuidedOpen(false);
    const started = Date.now();
    let response: IntakeResponse;

    if (providedProfile) {
      response = { profile: providedProfile, confidence: 1, followUpQuestions: [], mode: "local", redacted: false };
    } else {
      const local = extractLocally(clean);
      response = { profile: local.profile, confidence: local.confidence, followUpQuestions: [], mode: "local", redacted: false };
      try {
        const apiResponse = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean }) });
        if (apiResponse.ok) response = await apiResponse.json() as IntakeResponse;
      } catch { /* local extraction is the intentional offline fallback */ }
    }

    const elapsed = Date.now() - started;
    if (elapsed < 950) await new Promise((resolve) => setTimeout(resolve, 950 - elapsed));
    setProfile(response.profile);
    setIntake(response);
    sessionStorage.setItem("benefitfinder-session", JSON.stringify({ profile: response.profile, query: clean, intake: response }));
    setView("results");
  }

  function submitGuided(event: React.FormEvent) {
    event.preventDefault();
    const guidedProfile: UserProfile = {
      city: guided.city,
      state: "CA",
      incomeBand: guided.incomeBand as UserProfile["incomeBand"],
      housing: guided.housing as UserProfile["housing"],
      veteran: guided.veteran,
      hasHighWaterBill: guided.bills,
      childrenAges: guided.children === "young" ? [3] : guided.children === "school" ? [8] : undefined,
    };
    void analyze("Guided answers", guidedProfile);
  }

  function startVoice() {
    type Recognition = { lang: string; interimResults: boolean; start(): void; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onend: () => void; onerror: () => void };
    const RecognitionCtor = (window as typeof window & { webkitSpeechRecognition?: new () => Recognition; SpeechRecognition?: new () => Recognition }).SpeechRecognition ?? (window as typeof window & { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!RecognitionCtor) return;
    const recognition = new RecognitionCtor();
    recognition.lang = language === "es" ? "es-US" : language === "vi" ? "vi-VN" : "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => setQuery(event.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true); recognition.start();
  }

  async function shareList() {
    const text = results.filter((result) => result.status !== "unlikely").map((result) => `${result.program.name} — ${statusLabel(result.status, t)}\n${result.program.applyUrl}`).join("\n\n");
    if (navigator.share) await navigator.share({ title: "My BenefitFinder list", text });
    else await navigator.clipboard.writeText(text);
  }

  function reset() {
    sessionStorage.removeItem("benefitfinder-session");
    setQuery(""); setProfile({}); setIntake(null); setView("home"); setAnswer(null);
  }

  const shellClass = `app-shell ${largeText ? "large-text" : ""} ${highContrast ? "high-contrast" : ""}`;

  return (
    <main className={shellClass}>
      <header className="site-header">
        <button className="brand" onClick={reset} aria-label="BenefitFinder home">
          <span className="brand-mark">BF</span><span>BenefitFinder</span>
        </button>
        <nav aria-label="Main navigation">
          <a href="#how">{t.navHow}</a><a href="#privacy">{t.navPrivacy}</a>
        </nav>
        <div className="header-tools">
          <button className="utility-button" onClick={() => setLargeText((value) => !value)} aria-pressed={largeText}>A<span>A</span></button>
          <button className="utility-button contrast-button" onClick={() => setHighContrast((value) => !value)} aria-pressed={highContrast} aria-label="Toggle high contrast">◐</button>
          <label className="language-select"><span className="sr-only">Language</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">EN</option><option value="es">ES</option><option value="vi">VI</option></select></label>
        </div>
      </header>

      {view === "home" && (
        <>
          <section className="hero-section">
            <div className="hero-copy">
              <p className="eyebrow"><span>✦</span>{t.heroKicker}</p>
              <h1>{t.heroTitleA}<br /><em>{t.heroTitleB}</em></h1>
              <p className="hero-body">{t.heroBody}</p>
              <div className="trust-line"><span>● No account</span><span>● 10 verified programs</span><span>● Sunnyvale-first</span></div>
            </div>
            <form className="intake-card" onSubmit={(event) => { event.preventDefault(); void analyze(query); }}>
              <div className="card-topline"><label htmlFor="situation">{t.prompt}</label><span className="ai-badge">✦ AI-assisted</span></div>
              <div className="textarea-wrap">
                <textarea id="situation" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder} rows={6} maxLength={2000} />
                <button type="button" className={`mic-button ${listening ? "listening" : ""}`} onClick={startVoice} aria-label="Speak your situation">{listening ? "•••" : "⌁"}</button>
              </div>
              <div className="example-row"><button type="button" onClick={() => setQuery(demoText)}>Try a demo story</button><span>{query.length}/2000</span></div>
              <button className="primary-button" type="submit" disabled={query.trim().length < 8}>{t.find}<span>→</span></button>
              <button className="text-button" type="button" onClick={() => setGuidedOpen(true)}>{t.guided}<span>→</span></button>
              <p className="micro-privacy"><span>⌾</span> Your answers stay in this browser session. Never enter an SSN or document number.</p>
            </form>
          </section>

          <section className="principles" id="how">
            <article><span className="number">01</span><div><h2>{t.private}</h2><p>{t.privateBody}</p></div></article>
            <article><span className="number">02</span><div><h2>{t.rules}</h2><p>{t.rulesBody}</p></div></article>
            <article><span className="number">03</span><div><h2>{t.sources}</h2><p>{t.sourcesBody}</p></div></article>
          </section>

          <section className="architecture-strip" id="privacy">
            <span>YOUR STORY</span><b>→</b><span className="accent-step">AI EXTRACTS FACTS</span><b>→</b><span>RULES CHECK ELIGIBILITY</span><b>→</b><span>OFFICIAL SOURCES EXPLAIN</span>
          </section>
        </>
      )}

      {view === "analyzing" && (
        <section className="analyzing-screen" aria-live="polite">
          <div className="scan-orbit"><span>✦</span></div><p className="eyebrow">BenefitFinder engine</p><h1>{t.scan}</h1><p>{t.scanBody}</p>
          <div className="scan-steps"><span className="done">✓ Facts structured</span><span className="done">✓ Sensitive data screened</span><span className="active">Rules + evidence</span></div>
        </section>
      )}

      {view === "results" && (
        <section className="results-page">
          <div className="results-hero">
            <div><p className="eyebrow"><span>✦</span>{intake?.mode === "openai" ? `AI intake · ${intake.model}` : "Private local intake"}</p><h1>{t.resultsFor}</h1><p><strong>{matchedCount}</strong> {t.possible}</p></div>
            <div className="result-actions"><button onClick={() => void shareList()}>{t.share}</button><button onClick={() => window.print()}>{t.print}</button><button onClick={reset}>{t.startOver}</button></div>
          </div>

          <div className="profile-summary" aria-label="Extracted profile">
            <div className="profile-title"><span>AI</span><div><strong>What we understood</strong><small>{Math.round((intake?.confidence ?? 0) * 100)}% extraction confidence · edit by starting over</small></div></div>
            <div className="profile-chips">{Object.entries(profile).filter(([key]) => !["state", "zip", "interests", "activeDuty", "caregiver", "homeAgeYears", "hasHighWaterBill"].includes(key)).map(([key, value]) => <span key={key}>{profileLabel(key, value)}</span>)}</div>
            {(intake?.followUpQuestions?.length || followUps.length) > 0 && <p className="follow-up"><strong>Helpful follow-up:</strong> {(intake?.followUpQuestions?.length ? intake.followUpQuestions : followUps)[0]}</p>}
          </div>

          <div className="results-layout">
            <aside className="filter-panel">
              <p>SHOW</p>
              {(["all", "likely", "maybe", "unlikely"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}><span>{item === "all" ? t.all : statusLabel(item, t)}</span><b>{item === "all" ? results.length : results.filter((result) => result.status === item).length}</b></button>)}
              <div className="rule-note"><span>◇</span><p><strong>AI explains.<br />Rules decide.</strong><br />Every result includes an auditable match trace.</p></div>
            </aside>
            <div className="results-list">
              <div className="list-heading"><h2>{filter === "all" ? t.all : statusLabel(filter, t)}</h2><span>{visibleResults.length} programs</span></div>
              {visibleResults.map((result) => (
                <article className={`program-card ${result.status}`} key={result.program.id}>
                  <div className="program-card-main">
                    <div className="program-meta"><span className={`status ${result.status}`}>{result.status === "likely" ? "✓" : result.status === "maybe" ? "?" : "–"} {statusLabel(result.status, t)}</span><span>{result.program.level} · {result.program.category}</span></div>
                    <h3>{result.program.name}</h3><p className="benefit-line">{result.program.benefit}</p>
                    <div className="why-box"><strong>{t.why}</strong><p>{result.matchedRules.length ? result.matchedRules.slice(0, 2).join(". ") + "." : "More information is needed before the rules can make a strong match."}</p></div>
                    <div className="card-footer"><span>● {t.verified}: {result.program.lastVerified}</span><span>↗ {result.program.sourceLabel}</span></div>
                  </div>
                  <div className="program-card-actions"><button onClick={() => setSelected(result)}>{t.details}</button><a href={result.program.applyUrl} target="_blank" rel="noreferrer">{t.apply}<span>↗</span></a></div>
                </article>
              ))}

              <section className="ask-card">
                <div><p className="eyebrow"><span>✦</span>Grounded retrieval</p><h2>{t.askTitle}</h2><p>Searches only the official evidence attached to these results.</p></div>
                <form onSubmit={(event) => { event.preventDefault(); setAnswer(sourceSearch(question, results)); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t.askPlaceholder} /><button type="submit">{t.ask}</button></form>
                {answer && <div className="answer-box"><strong>{answer.program.name}</strong><p>{answer.program.sourceSnippet}</p><a href={answer.program.sourceUrl} target="_blank" rel="noreferrer">{answer.program.sourceLabel} ↗</a></div>}
              </section>
            </div>
          </div>
          <div className="disclaimer">ⓘ {t.reminder}</div>
        </section>
      )}

      <footer><span>BenefitFinder · CA-17</span><p>Built for clarity, privacy, and local impact.</p><a href="mailto:benefitfinder@example.org">Report an error ↗</a></footer>

      {guidedOpen && <div className="modal-backdrop" onMouseDown={() => setGuidedOpen(false)}><form className="guided-modal" onSubmit={submitGuided} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setGuidedOpen(false)} aria-label={t.close}>×</button><p className="eyebrow"><span>✦</span>Private mode</p><h2>{t.guidedTitle}</h2><p>{t.guidedBody}</p><div className="field-grid"><label>City<select value={guided.city} onChange={(event) => setGuided({ ...guided, city: event.target.value })}><option value="sunnyvale">Sunnyvale</option><option value="santa clara">Santa Clara</option><option value="san jose">San José</option><option value="mountain view">Mountain View</option></select></label><label>Annual household income<select value={guided.incomeBand} onChange={(event) => setGuided({ ...guided, incomeBand: event.target.value })}><option value="under25k">Under $25K</option><option value="25-50k">$25K–$50K</option><option value="50-80k">$50K–$80K</option><option value="80-120k">$80K–$120K</option><option value="over120k">Over $120K</option></select></label><label>Housing<select value={guided.housing} onChange={(event) => setGuided({ ...guided, housing: event.target.value })}><option value="rent">Rent</option><option value="own">Own</option><option value="other">Other</option></select></label><label>Children in your care<select value={guided.children} onChange={(event) => setGuided({ ...guided, children: event.target.value })}><option value="none">None</option><option value="young">Under age 5</option><option value="school">School age</option></select></label></div><div className="toggle-row"><label><input type="checkbox" checked={guided.veteran} onChange={(event) => setGuided({ ...guided, veteran: event.target.checked })} /> Veteran or military family</label><label><input type="checkbox" checked={guided.bills} onChange={(event) => setGuided({ ...guided, bills: event.target.checked })} /> High utility bills</label></div><button className="primary-button" type="submit">{t.continue}<span>→</span></button></form></div>}

      {selected && <div className="modal-backdrop detail-backdrop" onMouseDown={() => setSelected(null)}><aside className="detail-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)} aria-label={t.close}>×</button><div className="program-meta"><span className={`status ${selected.status}`}>{statusLabel(selected.status, t)}</span><span>{selected.program.jurisdiction}</span></div><h2>{selected.program.name}</h2><p className="drawer-summary">{selected.program.summary}</p><section><h3>{t.trace}</h3><div className="trace-list">{selected.matchedRules.map((rule) => <p key={rule}><span>✓</span>{rule}</p>)}{selected.missingInfo.map((field) => <p className="missing" key={field}><span>?</span>Need information: {field}</p>)}</div></section><section><h3>{t.evidence}</h3><blockquote>“{selected.program.sourceSnippet}”</blockquote><a href={selected.program.sourceUrl} target="_blank" rel="noreferrer">{selected.program.sourceLabel} ↗</a></section><section><h3>{t.next}</h3><ol>{selected.program.steps.map((step) => <li key={step}>{step}</li>)}</ol></section><p className="drawer-disclaimer">{t.reminder}</p><a className="primary-button apply-link" href={selected.program.applyUrl} target="_blank" rel="noreferrer">{t.apply}<span>↗</span></a></aside></div>}
    </main>
  );
}
