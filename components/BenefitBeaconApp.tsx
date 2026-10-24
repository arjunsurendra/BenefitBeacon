"use client";

import { useEffect, useRef, useState } from "react";
import { extractLocally } from "@/lib/intake/local-extractor";
import type { DiscoveryResponse, DiscoveredProgram, IntakeResponse, ProgramChatMessage, ProgramChatResponse, UserProfile } from "@/lib/types";

type Language = "en" | "es" | "vi";
type Experience = "guide" | "assistant";
type View = "home" | "analyzing" | "followup" | "results" | "browse";
type ScanMode = "profile" | "retrieval" | "live" | "browse";
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

type AgentFollowUp = {
  field: keyof FollowUpAnswers;
  profileField: keyof UserProfile;
  question: string;
  hint: string;
  options: Array<[string, string]>;
  visible?: (profile: UserProfile) => boolean;
};

type AgentConversationMessage = { role: "assistant" | "user"; text: string };

const emptyFollowUps: FollowUpAnswers = {
  location: "", ageRange: "", householdSize: "", incomeBand: "", housing: "", children: "", employment: "", veteran: "", activeDuty: "", disabled: "", caregiver: "", utilityBills: "", homeAgeYears: "", interests: [],
};

const agentFollowUps: AgentFollowUp[] = [
  { field: "ageRange", profileField: "ageRange", question: "Which age range includes you?", hint: "Age can open different health, food, tax, and utility programs.", options: [["under18", "Under 18"], ["18-24", "18–24"], ["25-54", "25–54"], ["55-61", "55–61"], ["62-64", "62–64"], ["65plus", "65 or older"]] },
  { field: "householdSize", profileField: "householdSize", question: "How many people live in your household?", hint: "An estimate is fine.", options: [["1", "1 person"], ["2", "2 people"], ["3", "3 people"], ["4", "4 people"], ["5", "5 people"], ["6", "6 or more"]] },
  { field: "incomeBand", profileField: "incomeBand", question: "About how much does your household receive in a year?", hint: "Choose a range—an exact amount is not needed.", options: [["under25k", "Under $25K"], ["25-50k", "$25K–$50K"], ["50-80k", "$50K–$80K"], ["80-120k", "$80K–$120K"], ["over120k", "Over $120K"]] },
  { field: "housing", profileField: "housing", question: "What is your current housing situation?", hint: "This helps separate renter, homeowner, and housing-stability programs.", options: [["rent", "I rent"], ["own", "I own my home"], ["unhoused", "I do not have stable housing"], ["other", "Another situation"]] },
  { field: "children", profileField: "childrenAges", question: "Are there children in your care?", hint: "This can uncover tax credits, food, child care, recreation, and family support.", options: [["none", "No"], ["young", "Yes, under age 5"], ["school", "Yes, school age"], ["both", "Yes, both age groups"]] },
  { field: "employment", profileField: "employment", question: "Which best describes your current work situation?", hint: "This can connect you with income, training, and senior programs.", options: [["employed", "Employed"], ["unemployed", "Looking for work"], ["retired", "Retired"], ["student", "Student"], ["other", "Another situation"]] },
  { field: "veteran", profileField: "veteran", question: "Do you have a veteran or military connection?", hint: "Veteran programs may offer additional local and federal support.", options: [["yes", "Yes"], ["no", "No"]] },
  { field: "activeDuty", profileField: "activeDuty", question: "Are you currently serving on active duty?", hint: "Some protections and programs are specific to active service.", options: [["yes", "Yes"], ["no", "No"]] },
  { field: "disabled", profileField: "disabled", question: "Would disability-related support be useful to you or someone in your household?", hint: "This may surface accessibility, transportation, home, and income support.", options: [["yes", "Yes"], ["no", "No"]] },
  { field: "caregiver", profileField: "caregiver", question: "Do you provide unpaid care for someone?", hint: "Caregivers may have additional support options.", options: [["yes", "Yes"], ["no", "No"]] },
  { field: "utilityBills", profileField: "hasHighWaterBill", question: "Are utility bills difficult to keep up with?", hint: "This includes electricity, gas, and water costs.", options: [["yes", "Yes"], ["no", "No"]] },
  { field: "homeAgeYears", profileField: "homeAgeYears", question: "About how old is your home?", hint: "A rough estimate can help find repair and efficiency programs.", options: [["5", "Under 10 years"], ["15", "10–20 years"], ["30", "21–40 years"], ["50", "More than 40 years"]], visible: (profile) => profile.housing === "own" },
  { field: "interests", profileField: "interests", question: "What kind of help should I prioritize first?", hint: "Choose the area that matters most right now.", options: [["food", "Food and groceries"], ["health", "Health care"], ["housing", "Rent or housing"], ["utilities", "Utility bills"], ["childcare", "Children and child care"], ["tax credits", "Tax credits and refunds"], ["transportation", "Transportation"], ["home repair", "Home repair"], ["employment", "Work and income"]] },
];

const copy = {
  en: {
    navBrowse: "Explore all programs", navMatch: "Ask BenefitBeacon", choiceTitle: "Let’s find the help meant for you.", choiceBody: "BenefitBeacon is your Sunnyvale benefits guide. Choose the way you want to begin, and it will stay with you through the next steps.", personalizedKicker: "Your benefits conversation", personalizedTitle: "What would make life a little easier?", personalizedBody: "Start anywhere—bills, food, housing, family, health, home repairs, or something else. You do not need to know a program name.", browseKicker: "Prefer to look around?", browseTitle: "Explore all Sunnyvale programs", browseBody: "See city, county, California, and federal programs available to Sunnyvale residents.", browseAction: "Explore all 52 programs", decisionTitle: "How would you like to begin?", decisionBody: "Choose the path that feels easiest. You can start over at any time.", guidedKicker: "Help me discover", guidedTitle: "What is available to me?", guidedBody: "Answer a few optional questions so BenefitBeacon can surface programs you may want to explore.", guidedAction: "Guide me with questions", describeKicker: "I have a need in mind", describeTitle: "I know what I want", describeBody: "Describe the kind of help you need in your own words.", allKicker: "Browse without questions", allTitle: "Show all available programs", allBody: "Browse every city, county, California, and federal program in the Sunnyvale guide.", allAction: "Show all 52 programs",
    navHow: "How I help", navPrivacy: "Privacy", heroKicker: "Meet your Sunnyvale benefits guide", heroTitleA: "Let’s find the help", heroTitleB: "meant for you.",
    heroBody: "Tell BenefitBeacon what is going on. It can ask optional follow-up questions, surface possible benefits, and help you understand each one.", prompt: "Tell BenefitBeacon what you need", placeholder: "Example: My energy bill keeps going up, I rent in Sunnyvale, and I’m living on retirement income.", find: "Start my benefits search",
    private: "You are in control", privateBody: "No account is needed. Skip any question, and never enter a Social Security or account number.", rules: "A guide that listens", rulesBody: "BenefitBeacon follows your needs, asks only useful questions, and explains why each program may matter.", sources: "52 programs ready to explore", sourcesBody: "Your guide checks Sunnyvale, county, California, and federal programs and always shows the official source.",
    scan: "Checking programs for you", scanBody: "Reviewing available programs and the details you chose to share.", resultsFor: "Programs that may help", possible: "programs worth exploring", likely: "Likely match", maybe: "Possible match", unlikely: "Unlikely", all: "All", why: "Why this may help", apply: "Visit program site", details: "See details", verified: "Last checked", reminder: "These are helpful starting points. Each program makes the final eligibility decision.", share: "Share list", print: "Print / Save PDF", startOver: "Start over", close: "Close", trace: "What may qualify", evidence: "Program information", next: "Suggested next steps", askTitle: "Ask about these programs", askPlaceholder: "Can renters get energy-bill help?", ask: "Find an answer",
    followTitle: "I have a few questions that could uncover more help", followBody: "Answer only what feels comfortable. Every question is optional, and you can ask me to continue at any time.", showResults: "Show what you found", skip: "Continue without answering", optional: "Optional", liveTitle: "Programs that may help", liveBody: "Programs chosen using the details you shared.", liveBadge: "Program to explore", liveWhy: "Why this may be relevant", published: "Who may qualify", noLocation: "BenefitBeacon currently serves Sunnyvale residents.", liveUnavailable: "I could not check the programs right now. Please try again.",
  },
  es: {
    navBrowse: "Explorar programas", navMatch: "Preguntar a BenefitBeacon", choiceTitle: "Encontremos la ayuda indicada para usted.", choiceBody: "BenefitBeacon es su guía de beneficios de Sunnyvale. Elija cómo desea comenzar y le acompañará en los próximos pasos.", personalizedKicker: "Su conversación de beneficios", personalizedTitle: "¿Qué haría su vida un poco más fácil?", personalizedBody: "Comience con facturas, alimentos, vivienda, familia, salud, reparaciones u otra necesidad.", browseKicker: "¿Prefiere explorar?", browseTitle: "Todos los programas de Sunnyvale", browseBody: "Vea programas municipales, del condado, de California y federales para residentes de Sunnyvale.", browseAction: "Explorar 52 programas", decisionTitle: "¿Cómo desea comenzar?", decisionBody: "Elija la opción más sencilla para usted. Puede volver a empezar en cualquier momento.", guidedKicker: "Ayúdeme a descubrir", guidedTitle: "¿Qué hay disponible para mí?", guidedBody: "Responda algunas preguntas opcionales para ver programas que podría explorar.", guidedAction: "Guíeme con preguntas", describeKicker: "Tengo una necesidad en mente", describeTitle: "Sé lo que necesito", describeBody: "Describa con sus propias palabras el tipo de ayuda que busca.", allKicker: "Explorar sin preguntas", allTitle: "Mostrar todos los programas", allBody: "Explore todos los programas municipales, del condado, de California y federales de la guía de Sunnyvale.", allAction: "Mostrar los 52 programas",
    navHow: "Cómo ayudo", navPrivacy: "Privacidad", heroKicker: "Su guía de beneficios de Sunnyvale", heroTitleA: "Encontremos la ayuda", heroTitleB: "indicada para usted.", heroBody: "Cuéntele a BenefitBeacon qué sucede. Puede hacer preguntas opcionales, encontrar beneficios y explicar cada uno.", prompt: "Dígale a BenefitBeacon qué necesita", placeholder: "Ejemplo: Mi factura de energía sigue subiendo, alquilo en Sunnyvale y vivo de mis ingresos de jubilación.", find: "Iniciar mi búsqueda", private: "Usted tiene el control", privateBody: "No necesita una cuenta. Omita cualquier pregunta y nunca escriba un número de Seguro Social o de cuenta.", rules: "Una guía que escucha", rulesBody: "BenefitBeacon sigue sus necesidades, hace preguntas útiles y explica por qué cada programa puede importar.", sources: "52 programas para explorar", sourcesBody: "Su guía revisa programas de Sunnyvale, el condado, California y federales, y siempre muestra la fuente oficial.", scan: "Revisando programas", scanBody: "Revisamos los programas disponibles y los datos que decidió compartir.", resultsFor: "Programas que pueden ayudar", possible: "programas para explorar", likely: "Probable", maybe: "Posible", unlikely: "Poco probable", all: "Todos", why: "Por qué puede ayudar", apply: "Visitar programa", details: "Ver detalles", verified: "Última revisión", reminder: "Estos son puntos de partida. Cada programa toma la decisión final sobre elegibilidad.", share: "Compartir", print: "Imprimir / PDF", startOver: "Empezar de nuevo", close: "Cerrar", trace: "Qué puede calificar", evidence: "Información del programa", next: "Próximos pasos", askTitle: "Pregunte sobre estos programas", askPlaceholder: "¿Hay ayuda de energía para inquilinos?", ask: "Buscar respuesta", followTitle: "Tengo algunas preguntas que podrían descubrir más ayuda", followBody: "Responda solo lo que desee. Todas las preguntas son opcionales.", showResults: "Mostrar lo que encontró", skip: "Continuar sin responder", optional: "Opcional", liveTitle: "Programas que pueden ayudar", liveBody: "Programas elegidos según la información que compartió.", liveBadge: "Programa para explorar", liveWhy: "Por qué puede ser relevante", published: "Quién puede calificar", noLocation: "BenefitBeacon actualmente sirve a residentes de Sunnyvale.", liveUnavailable: "No pude revisar los programas ahora. Inténtelo de nuevo.",
  },
  vi: {
    navBrowse: "Khám phá chương trình", navMatch: "Hỏi BenefitBeacon", choiceTitle: "Hãy tìm sự hỗ trợ dành cho bạn.", choiceBody: "BenefitBeacon là hướng dẫn phúc lợi Sunnyvale. Hãy chọn cách bạn muốn bắt đầu và công cụ sẽ đồng hành trong các bước tiếp theo.", personalizedKicker: "Cuộc trò chuyện phúc lợi", personalizedTitle: "Điều gì sẽ giúp cuộc sống dễ dàng hơn?", personalizedBody: "Bắt đầu với hóa đơn, thực phẩm, nhà ở, gia đình, sức khỏe, sửa nhà hoặc nhu cầu khác.", browseKicker: "Bạn muốn tự khám phá?", browseTitle: "Tất cả chương trình Sunnyvale", browseBody: "Xem chương trình thành phố, quận, California và liên bang dành cho cư dân Sunnyvale.", browseAction: "Khám phá 52 chương trình", decisionTitle: "Bạn muốn bắt đầu như thế nào?", decisionBody: "Chọn cách dễ nhất với bạn. Bạn có thể bắt đầu lại bất cứ lúc nào.", guidedKicker: "Giúp tôi khám phá", guidedTitle: "Tôi có thể nhận hỗ trợ nào?", guidedBody: "Trả lời vài câu hỏi tùy chọn để xem những chương trình đáng tìm hiểu.", guidedAction: "Hướng dẫn tôi bằng câu hỏi", describeKicker: "Tôi đã biết nhu cầu", describeTitle: "Tôi biết mình cần gì", describeBody: "Mô tả loại hỗ trợ bạn cần bằng lời của mình.", allKicker: "Xem không cần câu hỏi", allTitle: "Hiển thị mọi chương trình", allBody: "Xem tất cả chương trình thành phố, quận, California và liên bang trong hướng dẫn Sunnyvale.", allAction: "Hiển thị 52 chương trình",
    navHow: "Cách tôi giúp", navPrivacy: "Quyền riêng tư", heroKicker: "Hướng dẫn phúc lợi Sunnyvale", heroTitleA: "Hãy tìm sự hỗ trợ", heroTitleB: "dành cho bạn.", heroBody: "Hãy kể cho BenefitBeacon điều đang xảy ra. Công cụ có thể hỏi thêm tùy chọn, tìm quyền lợi và giải thích từng chương trình.", prompt: "Cho BenefitBeacon biết bạn cần gì", placeholder: "Ví dụ: Hóa đơn điện tăng, tôi thuê nhà ở Sunnyvale và sống bằng thu nhập hưu trí.", find: "Bắt đầu tìm phúc lợi", private: "Bạn có quyền kiểm soát", privateBody: "Không cần tài khoản. Có thể bỏ qua mọi câu hỏi và không nhập số An sinh Xã hội hoặc số tài khoản.", rules: "Một hướng dẫn biết lắng nghe", rulesBody: "BenefitBeacon theo nhu cầu của bạn, chỉ hỏi điều hữu ích và giải thích vì sao mỗi chương trình đáng xem.", sources: "52 chương trình để khám phá", sourcesBody: "Hướng dẫn kiểm tra các chương trình Sunnyvale, quận, California và liên bang, luôn kèm nguồn chính thức.", scan: "Đang kiểm tra chương trình", scanBody: "Xem xét các chương trình hiện có và thông tin bạn chọn chia sẻ.", resultsFor: "Các chương trình có thể giúp", possible: "chương trình đáng tìm hiểu", likely: "Có khả năng", maybe: "Có thể", unlikely: "Ít khả năng", all: "Tất cả", why: "Vì sao có thể giúp", apply: "Trang chương trình", details: "Xem chi tiết", verified: "Kiểm tra lần cuối", reminder: "Đây là những điểm khởi đầu hữu ích. Mỗi chương trình đưa ra quyết định cuối cùng về điều kiện.", share: "Chia sẻ", print: "In / PDF", startOver: "Bắt đầu lại", close: "Đóng", trace: "Điều gì có thể đủ điều kiện", evidence: "Thông tin chương trình", next: "Bước tiếp theo", askTitle: "Hỏi về chương trình", askPlaceholder: "Người thuê có được hỗ trợ điện không?", ask: "Tìm câu trả lời", followTitle: "Tôi có vài câu hỏi có thể giúp tìm thêm hỗ trợ", followBody: "Chỉ trả lời điều bạn muốn. Mọi câu hỏi đều tùy chọn.", showResults: "Hiển thị kết quả", skip: "Tiếp tục không trả lời", optional: "Tùy chọn", liveTitle: "Các chương trình có thể giúp", liveBody: "Các chương trình được chọn dựa trên thông tin bạn chia sẻ.", liveBadge: "Chương trình để khám phá", liveWhy: "Vì sao có thể phù hợp", published: "Ai có thể đủ điều kiện", noLocation: "BenefitBeacon hiện phục vụ cư dân Sunnyvale.", liveUnavailable: "Hiện không thể kiểm tra chương trình. Vui lòng thử lại.",
  },
} as const;

function profileLabel(field: string, value: unknown) {
  const labels: Record<string, string> = { city: "Location", zip: "ZIP", ageRange: "Age", householdSize: "Household", childrenAges: "Children", incomeBand: "Income", housing: "Housing", veteran: "Veteran", activeDuty: "Active duty", disabled: "Disability", caregiver: "Caregiver", employment: "Work", hasHighWaterBill: "Utility bills", interests: "Needs" };
  const display = Array.isArray(value) ? value.length ? value.join(", ") : "None" : value === true ? "Yes" : value === false ? "No" : String(value).replaceAll("k", "K");
  return `${labels[field] ?? field}: ${display}`;
}

function BrandLogo({ size }: { size: number }) {
  const source = size <= 64 ? "/benefitbeacon-logo-v1-64.png" : "/benefitbeacon-logo-v1-192.png";
  // This local, pre-sized brand asset is already optimized for each rendered size.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={source} width={size} height={size} alt="" />;
}

function LiveProgramCard({ program, t, related = false, onExplore, onGuidedApply }: { program: DiscoveredProgram; t: (typeof copy)[Language]; related?: boolean; onExplore: (program: DiscoveredProgram) => void; onGuidedApply: (program: DiscoveredProgram) => void }) {
  return <article className={`program-card live-program ${related ? "related-program" : ""}`}><div className="program-card-main"><div className="program-meta"><span className={`status ${related ? "related-source" : "live-source"}`}>{related ? "Also worth knowing" : "Official program"}</span><span>{program.level} · {program.category}</span></div><h3>{program.name}</h3><p className="benefit-line">{program.benefit}</p><p className="program-summary">{program.summary}</p><div className="why-box"><strong>{t.liveWhy}</strong><p>{program.relevanceReason}</p></div><div className="published-eligibility"><strong>{t.published}</strong><p>{program.eligibilityText}</p></div><div className="card-footer"><span>● {t.verified}: {new Date(program.lastChecked).toLocaleDateString()}</span><span>↗ {program.sourceLabel}</span></div></div><div className="program-card-actions"><button className="explore-program-button" type="button" onClick={() => onExplore(program)}><span aria-hidden="true">✦</span> Explore this</button><button className="guided-application-button" type="button" onClick={() => onGuidedApply(program)}><span aria-hidden="true">↗</span> Apply with BenefitBeacon</button><a className="secondary-action" href={program.sourceUrl} target="_blank" rel="noreferrer">Program details<span aria-hidden="true">↗</span></a></div></article>;
}

function BrowseProgramCard({ program, t, onExplore, onGuidedApply }: { program: DiscoveredProgram; t: (typeof copy)[Language]; onExplore: (program: DiscoveredProgram) => void; onGuidedApply: (program: DiscoveredProgram) => void }) {
  return <article className="browse-program-card"><div className="browse-program-top"><span>{program.category}</span><span>{program.level}</span></div><h3>{program.name}</h3><p className="browse-benefit">{program.benefit}</p><p>{program.summary}</p><div className="browse-eligibility"><strong>{t.published}</strong><p>{program.eligibilityText}</p></div><div className="browse-program-actions"><button className="explore-program-button" type="button" onClick={() => onExplore(program)}><span aria-hidden="true">✦</span> Explore this</button><button className="guided-application-button" type="button" onClick={() => onGuidedApply(program)}>Apply with BenefitBeacon ↗</button><a href={program.sourceUrl} target="_blank" rel="noreferrer">Program details ↗</a></div><div className="browse-program-footer"><span>{t.verified}: {new Date(program.lastChecked).toLocaleDateString()}</span><span>{program.sourceLabel}</span></div></article>;
}

function CitedAnswer({ message }: { message: ProgramChatMessage }) {
  if (/\[[^\]]+\]\(https:\/\/[^)]+\)/.test(message.text)) {
    const safeSources = new Set((message.sources ?? []).map((source) => source.url));
    const inline = (text: string, lineIndex: number) => {
      const parts: React.ReactNode[] = [];
      const pattern = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*/g;
      let cursor = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text))) {
        parts.push(text.slice(cursor, match.index));
        if (match[3]) parts.push(<strong key={`${lineIndex}-${match.index}`}>{match[3]}</strong>);
        else parts.push(safeSources.has(match[2]) ? <a key={`${lineIndex}-${match.index}`} href={match[2]} target="_blank" rel="noreferrer">{match[1]} <span className="sr-only">(opens in a new tab)</span></a> : match[1]);
        cursor = match.index + match[0].length;
      }
      parts.push(text.slice(cursor));
      return parts;
    };
    return <div className="chat-answer-markdown">{message.text.split("\n").map((line, index) => {
      const clean = line.trim();
      if (!clean) return <span className="chat-answer-space" key={index} aria-hidden="true" />;
      if (clean.startsWith("## ")) return <h4 key={index}>{inline(clean.slice(3), index)}</h4>;
      if (clean.startsWith("### ")) return <h5 key={index}>{inline(clean.slice(4), index)}</h5>;
      if (clean.startsWith("- ")) return <p className="chat-answer-bullet" key={index}><span aria-hidden="true">•</span><span>{inline(clean.slice(2), index)}</span></p>;
      const numbered = clean.match(/^(\d+)\.\s+(.+)$/);
      if (numbered) return <p className="chat-answer-numbered" key={index}><b>{numbered[1]}.</b><span>{inline(numbered[2], index)}</span></p>;
      return <p key={index}>{inline(clean, index)}</p>;
    })}</div>;
  }
  const valid = (message.citations ?? []).filter((citation) => citation.endIndex > 0 && citation.endIndex <= message.text.length).sort((left, right) => left.endIndex - right.endIndex);
  if (!valid.length) return <p className="chat-answer-text">{message.text}</p>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  valid.forEach((citation, index) => {
    if (citation.endIndex < cursor) return;
    parts.push(message.text.slice(cursor, citation.endIndex));
    parts.push(<a key={`${citation.url}-${index}`} href={citation.url} target="_blank" rel="noreferrer" aria-label={`Open cited source: ${citation.title}`}>[{index + 1}]</a>);
    cursor = citation.endIndex;
  });
  parts.push(message.text.slice(cursor));
  return <p className="chat-answer-text">{parts}</p>;
}

const analysisSequences: Record<ScanMode, string[]> = {
  profile: ["Reading what you shared", "Noting your location and needs", "Looking for useful help", "Preparing optional questions"],
  retrieval: ["Checking programs available near you", "Reviewing who each program serves", "Comparing your needs with program rules", "Putting the most useful programs first"],
  live: ["Looking for current program information", "Reading official program pages", "Checking eligibility and application details", "Preparing a clear answer"],
  browse: ["Gathering programs for your city", "Organizing city and county help", "Adding California and federal programs", "Preparing program details and links"],
};

const conversationStarters: Record<Language, string[]> = {
  en: ["My utility bills are too high", "I need help repairing my home", "I have kids and need affordable activities", "I’m buying my first home"],
  es: ["Mis facturas de servicios son muy altas", "Necesito ayuda para reparar mi casa", "Tengo hijos y necesito actividades económicas", "Voy a comprar mi primera casa"],
  vi: ["Hóa đơn tiện ích của tôi quá cao", "Tôi cần hỗ trợ sửa nhà", "Tôi có con và cần hoạt động giá phải chăng", "Tôi đang mua căn nhà đầu tiên"],
};

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
  const [experience, setExperience] = useState<Experience>("guide");
  const [language, setLanguage] = useState<Language>("en");
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<UserProfile>({});
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpAnswers>(emptyFollowUps);
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [discoveryNote, setDiscoveryNote] = useState("");
  const [scanPhase, setScanPhase] = useState("Understanding your situation");
  const [scanMode, setScanMode] = useState<ScanMode>("profile");
  const [analysisTick, setAnalysisTick] = useState(0);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [describeOpen, setDescribeOpen] = useState(false);
  const [activeProgram, setActiveProgram] = useState<DiscoveredProgram | null>(null);
  const [programChats, setProgramChats] = useState<Record<string, ProgramChatMessage[]>>({});
  const [chatInput, setChatInput] = useState("");
  const [chatLoadingId, setChatLoadingId] = useState<string | null>(null);
  const [chatError, setChatError] = useState("");
  const [extensionReady, setExtensionReady] = useState(false);
  const [applicationNotice, setApplicationNotice] = useState("");
  const [agentSkipped, setAgentSkipped] = useState<Array<keyof FollowUpAnswers>>([]);
  const [agentConversation, setAgentConversation] = useState<AgentConversationMessage[]>([]);
  const [agentSelectedProgramId, setAgentSelectedProgramId] = useState("");
  const agentChatLogRef = useRef<HTMLDivElement | null>(null);
  const agentAnswerPanelRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatCloseRef = useRef<HTMLButtonElement | null>(null);
  const chatDrawerRef = useRef<HTMLElement | null>(null);
  const t = copy[language];

  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined); }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    const ready = () => setExtensionReady(true);
    const handoff = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      try {
        const result = JSON.parse(detail) as { ok?: boolean };
        if (result.ok) setApplicationNotice("Your application is open. Select the BenefitBeacon icon in your browser to continue with the guide beside you.");
      } catch { /* ignore malformed extension messages */ }
    };
    window.addEventListener("benefitbeacon:extension-ready", ready);
    window.addEventListener("benefitbeacon:application-handoff", handoff);
    window.dispatchEvent(new CustomEvent("benefitbeacon:extension-probe"));
    return () => {
      window.removeEventListener("benefitbeacon:extension-ready", ready);
      window.removeEventListener("benefitbeacon:application-handoff", handoff);
    };
  }, []);
  useEffect(() => {
    if (view !== "home") document.getElementById("main-content")?.focus();
  }, [view]);
  useEffect(() => {
    if (view !== "analyzing") return;
    setAnalysisTick(0);
    const timer = window.setInterval(() => setAnalysisTick((current) => current + 1), 950);
    return () => window.clearInterval(timer);
  }, [view, scanMode]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [activeProgram, programChats, chatLoadingId]);
  useEffect(() => {
    if (!activeProgram) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveProgram(null);
        return;
      }
      if (event.key !== "Tab" || !chatDrawerRef.current) return;
      const focusable = [...chatDrawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => chatCloseRef.current?.focus(), 0);
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeys);
      previouslyFocused?.focus();
    };
  }, [activeProgram]);
  const directResults = (discovery?.candidates ?? []).filter((program) => program.matchType === "direct");
  const relatedResults = (discovery?.candidates ?? []).filter((program) => program.matchType === "related");
  const allResultPrograms = [...directResults, ...relatedResults];
  const matchedCount = directResults.length + relatedResults.length;
  const browseProgramsList = discovery?.mode === "browse" ? discovery.candidates : [];
  const activeChatMessages = activeProgram ? (programChats[activeProgram.id] ?? []) : [];
  const awaitingProgramDetail = activeChatMessages.at(-1)?.role === "assistant" && activeChatMessages.at(-1)?.needsMoreInfo === true;
  const effectiveAgentProfile = withFollowUps(profile, followUps);
  const pendingAgentQuestions = agentFollowUps.filter((question) => {
    if (agentSkipped.includes(question.field)) return false;
    if (Object.prototype.hasOwnProperty.call(effectiveAgentProfile, question.profileField)) return false;
    return question.visible?.(effectiveAgentProfile) ?? true;
  });
  const currentAgentQuestion = pendingAgentQuestions[0];
  const assistantSelectedProgram = allResultPrograms.find((program) => program.id === agentSelectedProgramId) ?? allResultPrograms[0] ?? null;
  useEffect(() => {
    if (view !== "followup" || experience !== "assistant") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = window.requestAnimationFrame(() => {
      agentChatLogRef.current?.scrollTo({ top: agentChatLogRef.current.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
      agentAnswerPanelRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
      agentAnswerPanelRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentAgentQuestion?.field, agentConversation.length, experience, view]);
  const browseGroups = [
    { level: "city", title: "Sunnyvale programs", description: "Programs administered by or specifically funded for Sunnyvale residents." },
    { level: "county", title: "County & regional programs", description: "Santa Clara County, transit, water, and regional utility support available locally." },
    { level: "state", title: "California programs", description: "Statewide benefits and regulated-utility assistance that may serve local residents." },
    { level: "federal", title: "Federal programs", description: "Nationwide programs that may apply to eligible Sunnyvale residents." },
  ] as const;

  async function finalizeResults(finalProfile: UserProfile, response: IntakeResponse) {
    setProfile(finalProfile);
    setScanPhase("Finding programs that may fit");
    setScanMode("retrieval");
    setView("analyzing");
    setDiscovery(null);
    setDiscoveryNote("");
    const sunnyvaleProfile = { ...finalProfile, city: "Sunnyvale", state: "CA" };
    setProfile(sunnyvaleProfile);
    const location = "Sunnyvale, CA";
    if (location) {
      try {
        const apiResponse = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location, profile: sunnyvaleProfile }) });
        const payload = await apiResponse.json() as DiscoveryResponse | { error?: string };
        if (apiResponse.ok && "geography" in payload) {
          setDiscovery(payload);
          setAgentSelectedProgramId(payload.candidates[0]?.id ?? "");
        }
        else setDiscoveryNote("error" in payload && payload.error ? payload.error : t.liveUnavailable);
      } catch { setDiscoveryNote(t.liveUnavailable); }
    } else setDiscoveryNote(t.noLocation);
    sessionStorage.setItem("benefitbeacon-session", JSON.stringify({ profile: sunnyvaleProfile, query, intake: response }));
    setView("results");
  }

  async function checkLiveSources() {
    const location = "Sunnyvale, CA";
    setScanPhase("Checking for the latest information");
    setScanMode("live");
    setView("analyzing");
    try {
      const apiResponse = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location, profile, liveFallback: true }) });
      const payload = await apiResponse.json() as DiscoveryResponse | { error?: string };
      if (apiResponse.ok && "geography" in payload) { setDiscovery(payload); setDiscoveryNote(""); }
      else setDiscoveryNote("error" in payload && payload.error ? payload.error : "We could not check for updates right now. Your program list is unchanged.");
    } catch { setDiscoveryNote("We could not check for updates right now. Your program list is unchanged."); }
    setView("results");
  }

  async function analyze(text: string) {
    const clean = text.trim();
    if (clean.length < 8) return;
    setScanPhase("Understanding your situation");
    setScanMode("profile");
    setView("analyzing");
    let response: IntakeResponse;
    const local = extractLocally(clean);
    response = { profile: local.profile, confidence: local.confidence, followUpQuestions: [], mode: "local", redacted: false };
    try {
      const apiResponse = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean }) });
      if (apiResponse.ok) response = await apiResponse.json() as IntakeResponse;
    } catch { /* the local extractor is the intentional fallback */ }
    const sunnyvaleProfile = { ...response.profile, city: "Sunnyvale", state: "CA" };
    const sunnyvaleResponse = { ...response, profile: sunnyvaleProfile };
    setProfile(sunnyvaleProfile);
    setIntake(sunnyvaleResponse);
    if (missingQuestionCount(sunnyvaleProfile) > 0) setView("followup");
    else await finalizeResults(sunnyvaleProfile, sunnyvaleResponse);
  }

  function submitFollowUps(event: React.FormEvent) {
    event.preventDefault();
    if (!intake) return;
    void finalizeResults(withFollowUps(profile, followUps), intake);
  }

  function startGuidedQuestions() {
    const guidedProfile: UserProfile = { city: "Sunnyvale", state: "CA" };
    const guidedIntake: IntakeResponse = { profile: guidedProfile, confidence: 1, followUpQuestions: [], mode: "local", redacted: false };
    setQuery("");
    setFollowUps(emptyFollowUps);
    setProfile(guidedProfile);
    setIntake(guidedIntake);
    setDiscovery(null);
    setDiscoveryNote("");
    setActiveProgram(null);
    setAgentSkipped([]);
    setAgentConversation([]);
    setView("followup");
  }

  function chooseAgentFollowUp(value: string, label: string) {
    if (!currentAgentQuestion || !intake) return;
    const nextFollowUps = {
      ...followUps,
      [currentAgentQuestion.field]: currentAgentQuestion.field === "interests" ? [value] : value,
    } as FollowUpAnswers;
    setFollowUps(nextFollowUps);
    setAgentConversation((current) => [...current, { role: "assistant", text: currentAgentQuestion.question }, { role: "user", text: label }]);
    const nextProfile = withFollowUps(profile, nextFollowUps);
    const remaining = agentFollowUps.filter((question) => {
      if (agentSkipped.includes(question.field)) return false;
      if (Object.prototype.hasOwnProperty.call(nextProfile, question.profileField)) return false;
      return question.visible?.(nextProfile) ?? true;
    });
    if (!remaining.length) void finalizeResults(nextProfile, intake);
  }

  function skipAgentFollowUp() {
    if (!currentAgentQuestion) return;
    setAgentSkipped((current) => [...current, currentAgentQuestion.field]);
    setAgentConversation((current) => [...current, { role: "assistant", text: currentAgentQuestion.question }, { role: "user", text: "I’d rather skip this." }]);
  }

  function finishAgentFollowUps() {
    if (intake) void finalizeResults(withFollowUps(profile, followUps), intake);
  }

  async function shareList() {
    const text = [...directResults, ...relatedResults].map((program) => `${program.name} — ${program.matchType === "related" ? "Also worth knowing" : t.liveBadge}\n${program.applyUrl}`).join("\n\n");
    if (navigator.share) await navigator.share({ title: "My BenefitBeacon list", text }); else await navigator.clipboard.writeText(text);
  }

  function openProgramChat(program: DiscoveredProgram) {
    setActiveProgram(program);
    setChatInput("");
    setChatError("");
  }

  function startGuidedApplication(program: DiscoveredProgram) {
    const session = {
      version: 1,
      createdAt: new Date().toISOString(),
      apiBase: window.location.origin,
      program,
      profile: Object.keys(profile).length ? profile : { city: "Sunnyvale", state: "CA" },
      history: programChats[program.id] ?? [],
    };
    sessionStorage.setItem("benefitbeacon-application", JSON.stringify(session));
    window.dispatchEvent(new CustomEvent("benefitbeacon:start-application", { detail: JSON.stringify(session) }));
    window.open(program.applyUrl, "_blank", "noopener,noreferrer");
    setActiveProgram(null);
    setApplicationNotice(extensionReady
      ? "Opening the official application. Select the BenefitBeacon icon in your browser to keep the guide beside you."
      : "The official application is open. Install or open the BenefitBeacon browser extension to continue with guided help.");
  }

  async function askProgramQuestion(suggestedQuestion?: string) {
    if (!activeProgram || chatLoadingId) return;
    const question = (suggestedQuestion ?? chatInput).trim();
    if (question.length < 2) return;
    const selectedProgram = activeProgram;
    const programId = selectedProgram.id;
    const history = programChats[programId] ?? [];
    const userMessage: ProgramChatMessage = { role: "user", text: question };
    setProgramChats((current) => ({ ...current, [programId]: [...(current[programId] ?? []), userMessage] }));
    setChatInput("");
    setChatError("");
    setChatLoadingId(programId);
    try {
      const response = await fetch("/api/program-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ programId, program: selectedProgram, question, history, profile }) });
      const payload = await response.json() as ProgramChatResponse | { error?: string };
      if (!response.ok || !("answer" in payload)) throw new Error("error" in payload && payload.error ? payload.error : "The program helper could not answer that question.");
      const assistantMessage: ProgramChatMessage = { role: "assistant", text: payload.answer, needsMoreInfo: payload.needsMoreInfo, citations: payload.citations, sources: payload.sources };
      setProgramChats((current) => ({ ...current, [programId]: [...(current[programId] ?? []), assistantMessage] }));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "The program helper is temporarily unavailable.");
    } finally {
      setChatLoadingId(null);
    }
  }

  async function browsePrograms() {
    setDiscovery(null);
    setDiscoveryNote("");
    setScanMode("browse");
    setScanPhase("Finding programs available in Sunnyvale");
    setView("analyzing");
    try {
      const apiResponse = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "Sunnyvale, CA", profile: { city: "Sunnyvale", state: "CA" }, browseAll: true }) });
      const payload = await apiResponse.json() as DiscoveryResponse | { error?: string };
      if (apiResponse.ok && "geography" in payload) setDiscovery(payload);
      else setDiscoveryNote("error" in payload && payload.error ? payload.error : "I could not open the program list right now.");
    } catch { setDiscoveryNote("I could not open the program list right now."); }
    setView("browse");
  }

  function showHomeSection(sectionId: "decision" | "personalized" | "how") {
    if (sectionId === "personalized") setDescribeOpen(true);
    if (view === "home") {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (sectionId === "personalized") document.getElementById("situation")?.focus();
      }, 0);
      return;
    }
    reset();
    if (sectionId === "personalized") setDescribeOpen(true);
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (sectionId === "personalized") document.getElementById("situation")?.focus();
    }, 0);
  }

  function openSituationInput() {
    setDescribeOpen(true);
    window.setTimeout(() => document.getElementById("situation")?.focus(), 0);
  }

  function reset() {
    sessionStorage.removeItem("benefitbeacon-session");
    setQuery(""); setProfile({}); setIntake(null); setFollowUps(emptyFollowUps); setDiscovery(null); setDiscoveryNote(""); setActiveProgram(null); setProgramChats({}); setChatError(""); setDescribeOpen(false); setAgentSkipped([]); setAgentConversation([]); setAgentSelectedProgramId(""); setView("home");
  }

  function switchExperience(next: Experience) {
    if (next === experience) return;
    reset();
    setExperience(next);
  }

  function setFollowUp(field: keyof FollowUpAnswers, value: string | string[]) { setFollowUps((current) => ({ ...current, [field]: value })); }
  function toggleInterest(value: string) { setFollowUps((current) => ({ ...current, interests: current.interests.includes(value) ? current.interests.filter((item) => item !== value) : [...current.interests, value] })); }

  const select = (label: string, field: keyof FollowUpAnswers, options: Array<[string, string]>) => (
    <label>{label}<span>{t.optional}</span><select value={followUps[field] as string} onChange={(event) => setFollowUp(field, event.target.value)}><option value="">Prefer not to answer</option>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>
  );
  const yesNo = (label: string, field: keyof FollowUpAnswers) => select(label, field, [["yes", "Yes"], ["no", "No"]]);
  const shellClass = `app-shell experience-${experience} ${largeText ? "large-text" : ""} ${highContrast ? "high-contrast" : ""}`;

  return (
    <div className={shellClass}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <button className="brand" onClick={reset} aria-label="BenefitBeacon home"><span className="brand-mark"><BrandLogo size={42} /></span><span className="brand-copy"><strong>BenefitBeacon</strong><small>{experience === "assistant" ? "Your benefits assistant" : "Sunnyvale guide"}</small></span></button>
        {experience === "guide" && <nav aria-label="Main navigation"><button onClick={() => void browsePrograms()}>{t.navBrowse}</button><button onClick={() => showHomeSection("decision")}>{t.navMatch}</button><button onClick={() => showHomeSection("how")}>{t.navHow}</button></nav>}
        <div className="header-tools" aria-label="Experience, accessibility, and language settings">
          <div className="experience-switch" role="group" aria-label="Choose BenefitBeacon experience"><button type="button" className={experience === "guide" ? "active" : ""} onClick={() => switchExperience("guide")} aria-pressed={experience === "guide"}>Resident guide</button><button type="button" className={experience === "assistant" ? "active" : ""} onClick={() => switchExperience("assistant")} aria-pressed={experience === "assistant"}>AI assistant</button></div>
          <button className="utility-button" onClick={() => setLargeText((value) => !value)} aria-pressed={largeText} aria-label={largeText ? "Use standard text size" : "Use extra-large text"} title={largeText ? "Use standard text size" : "Use extra-large text"}>A+</button><button className="utility-button contrast-button" onClick={() => setHighContrast((value) => !value)} aria-pressed={highContrast} aria-label={highContrast ? "Use standard colors" : "Use high contrast colors"} title={highContrast ? "Use standard colors" : "Use high contrast colors"}>◐</button><label className="language-select"><span className="sr-only">Choose language</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label="Choose language"><option value="en">English</option><option value="es">Español</option><option value="vi">Tiếng Việt</option></select></label>
        </div>
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>
      {view === "home" && experience === "guide" && <>
        <section className="agent-home">
          <div className="agent-hero-grid">
            <div className="agent-intro">
              <div className="agent-title-block"><p className="eyebrow"><span>⌖</span>{t.heroKicker}</p><h1>{t.choiceTitle}</h1></div>
              <div className="agent-intro-summary"><p className="agent-intro-copy">{t.choiceBody}</p><div className="agent-capabilities" aria-label="How BenefitBeacon helps"><span><b>01</b> Listens</span><span><b>02</b> Finds a fit</span><span><b>03</b> Guides you</span></div></div>
            </div>

            <section id="decision" className="decision-panel" aria-labelledby="decision-title">
              <div className="decision-heading"><div><p>Hi, I’m BenefitBeacon.</p><h2 id="decision-title">{t.decisionTitle}</h2><span>{t.decisionBody}</span></div></div>
              <ol className="decision-tree">
                <li className="decision-branch guided-branch">
                  <button className="decision-card guided-decision" type="button" onClick={startGuidedQuestions}>
                    <span className="decision-number" aria-hidden="true">01</span><span className="decision-copy"><small>{t.guidedKicker}</small><strong>{t.guidedTitle}</strong><span>{t.guidedBody}</span></span><b>{t.guidedAction}<span aria-hidden="true">→</span></b>
                  </button>
                </li>
                <li className="decision-branch describe-branch">
                  <button className={`decision-card describe-decision ${describeOpen ? "is-active" : ""}`} type="button" onClick={openSituationInput} aria-expanded={describeOpen} aria-controls="personalized">
                    <span className="decision-number" aria-hidden="true">02</span><span className="decision-copy"><small>{t.describeKicker}</small><strong>{t.describeTitle}</strong><span>{t.describeBody}</span></span><b>Tell me what you need<span aria-hidden="true">→</span></b>
                  </button>
                </li>
                <li className="decision-branch all-branch">
                  <button className="decision-card all-decision" type="button" onClick={() => void browsePrograms()}>
                    <span className="decision-number" aria-hidden="true">03</span><span className="decision-copy"><small>{t.allKicker}</small><strong>{t.allTitle}</strong><span>{t.allBody}</span></span><b>{t.allAction}<span aria-hidden="true">→</span></b>
                  </button>
                </li>
              </ol>
              <form id="personalized" className="decision-free-text" hidden={!describeOpen} onSubmit={(event) => { event.preventDefault(); void analyze(query); }}>
                <label htmlFor="situation">{t.personalizedTitle}</label>
                <div className="agent-input-wrap"><textarea id="situation" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder} rows={4} minLength={8} maxLength={2000} required aria-describedby="situation-help situation-privacy" /><span aria-hidden="true">✦</span></div>
                <div className="example-row" id="situation-help"><span>Write it naturally—no program name needed</span><span aria-live="polite">{query.length}/2000</span></div>
                <div className="decision-starters" aria-label="Conversation starters">{conversationStarters[language].map((starter) => <button type="button" key={starter} onClick={() => setQuery(starter)}>{starter}</button>)}</div>
                <button className="agent-submit" type="submit" disabled={query.trim().length < 8}><span>{t.find}<small>BenefitBeacon may ask optional questions</small></span><b aria-hidden="true">→</b></button>
              </form>
              <p className="decision-privacy" id="situation-privacy"><span aria-hidden="true">⌾</span> Private · no account needed · never enter an SSN or account number</p>
            </section>
          </div>

          <section className="opportunity-section" aria-labelledby="opportunity-title">
            <div className="opportunity-heading"><div><p className="eyebrow"><span>↗</span>What may be on the table</p><h2 id="opportunity-title">Sunnyvale support is valuable. <em>Let’s make sure you see it.</em></h2></div><p>These are examples of published program maximums—not a promise of eligibility. BenefitBeacon helps you find which opportunities are worth checking.</p></div>
            <div className="opportunity-grid">
              <a href="https://www.sunnyvale.ca.gov/home/showpublisheddocument/6083/638918972045670000" target="_blank" rel="noreferrer"><span className="opportunity-tag">HOME SUPPORT</span><strong>$34K</strong><h3>in listed grant maximums</h3><p>Across access, roof, emergency repair and energy-efficiency grants. Separate rules and funding apply.</p><b>Official City source ↗</b></a>
              <a href="https://www.sunnyvale.ca.gov/city-services/customer-resources/affordability-and-assistance/city-grants-and-loans" target="_blank" rel="noreferrer"><span className="opportunity-tag">FIRST HOME</span><strong>$50K</strong><h3>homebuyer loan assistance</h3><p>Maximum second-mortgage assistance for eligible first-time buyers in the City program.</p><b>Official City source ↗</b></a>
              <a href="https://www.sunnyvale.ca.gov/recreation-and-community/classes-and-activities/recreation-scholarship-program" target="_blank" rel="noreferrer"><span className="opportunity-tag">YOUTH</span><strong>$500</strong><h3>per approved child</h3><p>For eligible Sunnyvale youth to join City recreation activities, camps and classes.</p><b>Official City source ↗</b></a>
              <article className="opportunity-action" id="explore"><span className="opportunity-tag">YOUR CITY</span><strong>52</strong><h3>programs BenefitBeacon can explore</h3><p>City, county, California and federal support—all connected to official program pages.</p><button type="button" onClick={() => void browsePrograms()}>{t.browseAction}<span aria-hidden="true">→</span></button></article>
            </div>
            <p className="opportunity-note">Amounts are separate program maximums and may not be combined. Eligibility, available funding and final awards are decided by each program.</p>
          </section>
        </section>

        <section className="agent-principles" id="how"><div className="agent-principles-heading"><p className="eyebrow"><span>✦</span>A guide, not a checklist</p><h2>BenefitBeacon stays in the conversation.</h2></div><div className="agent-principles-grid"><article><span>01</span><h3>{t.private}</h3><p>{t.privateBody}</p></article><article><span>02</span><h3>{t.rules}</h3><p>{t.rulesBody}</p></article><article><span>03</span><h3>{t.sources}</h3><p>{t.sourcesBody}</p></article></div></section>
        <section className="agent-invitation" id="privacy"><div><p><strong>Not sure where to begin?</strong> Answer a few optional questions and BenefitBeacon will show you useful places to start.</p></div><button type="button" onClick={startGuidedQuestions}>Help me discover benefits <span aria-hidden="true">→</span></button></section>
      </>}

      {view === "home" && experience === "assistant" && <section className="assistant-home" aria-labelledby="assistant-home-title">
        <div className="assistant-ambient" aria-hidden="true"><span /><span /><span /></div>
        <div className="assistant-home-inner">
          <div className="assistant-identity">
            <div className="assistant-person" aria-hidden="true"><span className="assistant-person-head" /><span className="assistant-person-body" /><i /></div>
            <p><span /> BenefitBeacon is ready</p>
          </div>
          <div className="assistant-welcome">
            <p className="assistant-kicker">YOUR PERSONAL AI ASSISTANT FOR GOVERNMENT BENEFITS</p>
            <h1 id="assistant-home-title">Hi, I’m Beacon.<br /><em>How can I help today?</em></h1>
            <p>Talk to me like you would talk to someone at City Hall. I know the programs available to Sunnyvale residents, I can ask useful follow-up questions, and I’ll stay with you through the application.</p>
          </div>
          <form className="assistant-prompt" onSubmit={(event) => { event.preventDefault(); setAgentConversation([{ role: "user", text: query.trim() }]); void analyze(query); }}>
            <label htmlFor="assistant-situation">What’s going on?</label>
            <div className="assistant-prompt-box"><textarea id="assistant-situation" value={query} onChange={(event) => setQuery(event.target.value)} rows={3} minLength={8} maxLength={2000} required placeholder="Tell me what would make life a little easier…" /><button type="submit" disabled={query.trim().length < 8} aria-label="Send to BenefitBeacon">↑</button></div>
            <div className="assistant-prompt-meta"><span>Ask in your own words</span><span>Private · no account needed</span></div>
          </form>
          <div className="assistant-samples" aria-label="Try a sample question">
            <p>Not sure what to say? Try one:</p>
            <div>{["I’m retired and my utility bills keep rising", "I need help with rent and groceries", "My home needs safety repairs", "I have kids and need affordable activities"].map((starter) => <button type="button" key={starter} onClick={() => setQuery(starter)}><span aria-hidden="true">↗</span>{starter}</button>)}</div>
          </div>
          <div className="assistant-trust-row"><span><b>52</b> programs for Sunnyvale</span><span><b>Official</b> sources checked</span><span><b>You</b> choose what to share</span></div>
        </div>
      </section>}

      {view === "analyzing" && experience === "assistant" && <section className="assistant-thinking" role="status" aria-live="polite" aria-busy="true"><div className="assistant-person thinking" aria-hidden="true"><span className="assistant-person-head" /><span className="assistant-person-body" /><i /></div><p>Beacon is working on it</p><h1>{scanMode === "browse" ? "Opening every available program" : "Finding the help that fits your situation"}</h1><div className="assistant-thinking-line"><span /><span>{analysisSequences[scanMode][analysisTick % analysisSequences[scanMode].length]}</span></div><small>Checking Sunnyvale, county, California, and federal programs</small></section>}

      {view === "analyzing" && experience === "guide" && <section className="analyzing-screen technical-analysis" role="status" aria-live="polite" aria-busy="true">
        <div className="analysis-heading"><h1>{scanMode === "browse" ? "Opening the benefit landscape" : t.scan}</h1><p>{scanPhase}</p></div>
        <div className="analysis-progress">
          <div className="thought-stream"><span className="thinking-dot" /><div><small>CHECKING NOW</small><strong>{analysisSequences[scanMode][analysisTick % analysisSequences[scanMode].length]}</strong></div><span className="thought-counter">0{(analysisTick % analysisSequences[scanMode].length) + 1} / 0{analysisSequences[scanMode].length}</span></div>
          <div className="reasoning-track">{analysisSequences[scanMode].map((step, index) => { const activeIndex = analysisTick % analysisSequences[scanMode].length; return <div key={step} className={index < activeIndex ? "complete" : index === activeIndex ? "active" : "queued"}><span>{index < activeIndex ? "✓" : index + 1}</span><p>{step}</p></div>; })}</div>
        </div>
        <p className="analysis-note">BenefitBeacon uses the details you choose to share to find helpful programs. Each program makes the final eligibility decision.</p>
      </section>}

      {view === "followup" && experience === "assistant" && <section className="assistant-followup" aria-labelledby="assistant-followup-title">
        <div className="assistant-chat-shell">
          <header><div className="assistant-person small" aria-hidden="true"><span className="assistant-person-head" /><span className="assistant-person-body" /><i /></div><div><span>BenefitBeacon</span><strong id="assistant-followup-title">Let’s find every useful option</strong></div><button type="button" onClick={finishAgentFollowUps}>Show results now</button></header>
          <div ref={agentChatLogRef} className="assistant-chat-log" role="log" aria-live="polite">
            <article className="assistant-chat-message beacon"><span>Beacon</span><p>I can narrow down the programs that may fit. I’ll ask one question at a time, and you can skip anything.</p></article>
            {agentConversation.map((message, index) => <article className={`assistant-chat-message ${message.role === "assistant" ? "beacon" : "resident"}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "Beacon" : "You"}</span><p>{message.text}</p></article>)}
            {currentAgentQuestion ? <article className="assistant-chat-message beacon current"><span>Beacon</span><p>{currentAgentQuestion.question}</p><small>{currentAgentQuestion.hint}</small></article> : <article className="assistant-chat-message beacon current"><span>Beacon</span><p>That gives me enough to build your benefit list.</p></article>}
          </div>
          {currentAgentQuestion && <div ref={agentAnswerPanelRef} className="assistant-answer-panel"><div className="assistant-answer-options">{currentAgentQuestion.options.map(([value, label]) => <button type="button" key={value} onClick={() => chooseAgentFollowUp(value, label)}>{label}<span aria-hidden="true">→</span></button>)}</div><div className="assistant-answer-actions"><button type="button" onClick={skipAgentFollowUp}>Skip this question</button><button type="button" onClick={finishAgentFollowUps}>Show my benefits now</button></div></div>}
          {!currentAgentQuestion && <div ref={agentAnswerPanelRef} className="assistant-answer-panel complete"><button type="button" onClick={finishAgentFollowUps}>Show my benefit matches <span aria-hidden="true">→</span></button></div>}
          <footer><span>⌾</span> Never share Social Security, account, or document numbers.</footer>
        </div>
        <aside className="assistant-conversation-progress"><p>What I’m learning</p><strong>{Object.keys(effectiveAgentProfile).filter((key) => !["city", "state"].includes(key)).length}</strong><span>helpful details shared</span><div><i style={{ width: `${Math.min(100, Math.max(8, ((agentFollowUps.length - pendingAgentQuestions.length) / agentFollowUps.length) * 100))}%` }} /></div><small>You can see your matches at any time.</small></aside>
      </section>}

      {view === "followup" && experience === "guide" && <section className="followup-page">
        <div className="followup-agent"><span className="agent-orb" aria-hidden="true"><BrandLogo size={48} /></span><div><p>BenefitBeacon</p><h1>{t.followTitle}</h1><p>{t.followBody}</p></div></div>
        <form className="followup-form" onSubmit={submitFollowUps}>
          <div className="followup-grid">
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
            {profile.interests === undefined && <fieldset className="interest-field wide-field"><legend>What kind of help would be useful? <span>{t.optional}</span></legend><div>{[["food", "Food"], ["health", "Health care"], ["housing", "Housing"], ["utilities", "Utilities"], ["childcare", "Child care"], ["tax credits", "Tax credits"], ["transportation", "Transportation"], ["home repair", "Home repair"], ["employment", "Work"]].map(([value, label]) => <label key={value}><input type="checkbox" checked={followUps.interests.includes(value)} onChange={() => toggleInterest(value)} />{label}</label>)}</div></fieldset>}
          </div>
          <div className="followup-actions"><button className="primary-button" type="submit">{t.showResults}<span>→</span></button><button className="skip-button" type="button" onClick={() => intake && void finalizeResults(profile, intake)}>{t.skip}</button></div>
        </form>
      </section>}

      {view === "browse" && <section className="browse-page" aria-live="polite">
        <div className="browse-hero"><div><p className="eyebrow"><span>⌖</span>Sunnyvale benefit guide</p><h1>Explore every program for <em>Sunnyvale</em></h1><p>Browse city, county, California, and federal programs available to Sunnyvale residents. You do not need to share personal information.</p></div><div className="browse-hero-actions"><button className="personalize-button" onClick={startGuidedQuestions}>Help me find what fits <span>→</span></button></div></div>
        <div className="browse-summary"><span><b>{browseProgramsList.length}</b> programs available</span><span><b>4</b> levels of support</span><span><b>Every</b> program includes an official link</span></div>
        {discoveryNote && <p className="live-note">ⓘ {discoveryNote}</p>}
        {browseGroups.map((group) => { const programs = browseProgramsList.filter((program) => program.level === group.level); return programs.length > 0 && <section className="browse-group" key={group.level} aria-labelledby={`browse-${group.level}`}><div className="browse-group-heading"><div><p className="eyebrow">{group.level === "city" ? "Sunnyvale" : group.level}</p><h2 id={`browse-${group.level}`}>{group.title}</h2><p>{group.description}</p></div><span>{programs.length} programs</span></div><div className="browse-program-grid">{programs.map((program) => <BrowseProgramCard key={program.id} program={program} t={t} onExplore={openProgramChat} onGuidedApply={startGuidedApplication} />)}</div></section>; })}
        <div className="disclaimer">ⓘ {t.reminder}</div>
      </section>}

      {view === "results" && experience === "assistant" && <section className="assistant-results" aria-live="polite">
        <header className="assistant-results-heading"><div><p><span aria-hidden="true">✦</span> Your BenefitBeacon shortlist</p><h1>I found <em>{matchedCount} programs</em> to explore.</h1><span>Select a program to understand why it may fit and what to do next.</span></div><div><button type="button" onClick={reset}>Start a new conversation</button><button type="button" onClick={() => void shareList()}>Share this list</button></div></header>
        {discoveryNote && <p className="live-note">ⓘ {discoveryNote}</p>}
        {allResultPrograms.length > 0 ? <div className="assistant-results-workspace">
          <aside className="assistant-program-list" aria-label="Programs that may help"><div><span>{allResultPrograms.length} matches</span><small>Best fit first</small></div>{allResultPrograms.map((program, index) => <button type="button" key={program.id} className={assistantSelectedProgram?.id === program.id ? "selected" : ""} onClick={() => setAgentSelectedProgramId(program.id)} aria-pressed={assistantSelectedProgram?.id === program.id}><span className="assistant-program-rank">{String(index + 1).padStart(2, "0")}</span><span><small>{program.level} · {program.category}</small><strong>{program.name}</strong><em>{program.benefit}</em></span><b aria-hidden="true">→</b></button>)}</aside>
          {assistantSelectedProgram && <article className="assistant-program-detail">
            <div className="assistant-detail-top"><div><span>{assistantSelectedProgram.level}</span><span>{assistantSelectedProgram.category}</span></div><small>Checked {new Date(assistantSelectedProgram.lastChecked).toLocaleDateString()}</small></div>
            <h2>{assistantSelectedProgram.name}</h2><p className="assistant-detail-benefit">{assistantSelectedProgram.benefit}</p><p className="assistant-detail-summary">{assistantSelectedProgram.summary}</p>
            <section><span>Why Beacon chose this</span><p>{assistantSelectedProgram.relevanceReason}</p></section>
            <section><span>Who may qualify</span><p>{assistantSelectedProgram.eligibilityText}</p></section>
            <div className="assistant-detail-actions"><button type="button" className="assistant-launch" onClick={() => startGuidedApplication(assistantSelectedProgram)}><span><strong>Launch with BenefitBeacon</strong><small>Open the application with your assistant beside you</small></span><b aria-hidden="true">↗</b></button><button type="button" onClick={() => openProgramChat(assistantSelectedProgram)}>Ask Beacon about this program</button><a href={assistantSelectedProgram.sourceUrl} target="_blank" rel="noreferrer">View official program details ↗</a></div>
            <p className="assistant-extension-note"><span aria-hidden="true">◉</span>{extensionReady ? "Beacon Benefit is connected and ready to continue on the application website." : "Open the Beacon Benefit Chrome extension after the application website launches."}</p>
          </article>}
        </div> : <div className="assistant-empty-results"><h2>I couldn’t find a close match yet.</h2><p>Try a new conversation and share the kind of help you need most.</p><button type="button" onClick={reset}>Talk with Beacon again</button></div>}
        <p className="assistant-results-disclaimer">BenefitBeacon provides helpful starting points. Each program makes the final eligibility and award decision.</p>
      </section>}

      {view === "results" && experience === "guide" && <section className="results-page" aria-live="polite">
        <div className="results-hero agent-results-hero"><div className="results-agent-orb"><span className="agent-orb" aria-hidden="true"><BrandLogo size={68} /></span><i /></div><div><p className="eyebrow"><span>✦</span>BenefitBeacon found a path forward</p><h1>I found <em>{matchedCount} programs</em> worth exploring.</h1><p>I used what you shared to put the most useful possibilities first. Open any program and keep asking me questions.</p></div><div className="result-actions">{discovery?.fallbackAvailable && discovery.mode !== "live-fallback" && <button onClick={() => void checkLiveSources()}>Check for updates</button>}<button onClick={() => void shareList()}>{t.share}</button><button onClick={() => window.print()}>{t.print}</button><button onClick={reset}>{t.startOver}</button></div></div>
        <div className="profile-summary" aria-label="Details you shared"><div className="profile-title"><span>✦</span><div><strong>Here’s what I heard</strong><small>You can start over if anything looks wrong</small></div></div><div className="profile-chips">{Object.entries(profile).filter(([key]) => !["state", "homeAgeYears", "language"].includes(key)).map(([key, value]) => <span key={key}>{profileLabel(key, value)}</span>)}</div></div>

        <div className="results-list unified-results">
          <div className="list-heading unified-list-heading"><div><p className="eyebrow"><span aria-hidden="true">⌁</span>Your guided shortlist</p><h2>Start with these programs</h2><p>{discovery?.mode === "live-fallback" ? "I checked current program information based on what you shared." : "I chose these possibilities from programs serving Sunnyvale residents."}</p></div><span>{directResults.length} programs</span></div>
          {discoveryNote && <p className="live-note">ⓘ {discoveryNote}</p>}
          {!discoveryNote && directResults.length === 0 && <p className="live-note">We could not find a close match with the details provided. Try starting over and sharing a little more information.</p>}
          {directResults.map((program) => <LiveProgramCard key={program.id} program={program} t={t} onExplore={openProgramChat} onGuidedApply={startGuidedApplication} />)}

          {relatedResults.length > 0 && <section className="related-benefits-section" aria-labelledby="related-benefits-title"><div className="related-benefits-heading"><p className="eyebrow"><span aria-hidden="true">✦</span>Did you know?</p><h2 id="related-benefits-title">Your city, state, or federal programs may offer more help</h2><p>These are not exact matches to your request, but your location and the details you shared make them especially worth knowing about.</p></div>{relatedResults.map((program) => <LiveProgramCard key={program.id} program={program} t={t} related onExplore={openProgramChat} onGuidedApply={startGuidedApplication} />)}</section>}
        </div><div className="disclaimer">ⓘ {t.reminder}</div>
      </section>}

      {activeProgram && <div className="program-chat-layer">
        <div className="program-chat-scrim" aria-hidden="true" onClick={() => setActiveProgram(null)} />
        <aside ref={chatDrawerRef} className="program-chat-drawer" role="dialog" aria-modal="true" aria-labelledby="program-chat-title">
          <header className="program-chat-header">
            <h2 id="program-chat-title">{activeProgram.name}</h2>
            <button ref={chatCloseRef} type="button" onClick={() => setActiveProgram(null)} aria-label="Close chat">×</button>
          </header>

          <div className="program-chat-messages" role="log" aria-live="polite" aria-relevant="additions">
            {activeChatMessages.length === 0 && <div className="program-chat-welcome">
              <div className="program-chat-suggestions" aria-label="Suggested questions">
                {["Do I qualify?", "What do I need?", "How do I apply?"].map((question) => <button key={question} type="button" onClick={() => void askProgramQuestion(question)}>{question}</button>)}
              </div>
            </div>}

            {activeChatMessages.map((message, index) => <article className={`program-chat-message ${message.role}${message.needsMoreInfo ? " follow-up-question" : ""}`} key={`${message.role}-${index}`}>
              <span>{message.role === "user" ? "You" : message.needsMoreInfo ? "One detail needed" : "BenefitBeacon"}</span>
              {message.role === "assistant" ? <CitedAnswer message={message} /> : <p>{message.text}</p>}
              {message.needsMoreInfo && index === activeChatMessages.length - 1 && <button className="skip-chat-detail" type="button" onClick={() => void askProgramQuestion("I prefer not to share that detail. Please explain what can be determined without it.")}>Skip this detail</button>}
              {message.role === "assistant" && Boolean(message.sources?.length) && <details className="program-chat-sources">
                <summary>Information checked ({message.sources?.length})</summary>
                <div>{message.sources?.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a>)}</div>
              </details>}
            </article>)}

            {chatLoadingId === activeProgram.id && <div className="program-chat-searching" role="status"><div aria-hidden="true"><span /><span /><span /></div><p>Checking program information…</p></div>}
            {chatError && !chatLoadingId && <p className="program-chat-error" role="alert">{chatError}</p>}
            <div ref={chatEndRef} />
          </div>

          <form className="program-chat-composer" onSubmit={(event) => { event.preventDefault(); void askProgramQuestion(); }}>
            <label className="sr-only" htmlFor="program-chat-question">Ask a question about {activeProgram.name}</label>
            <textarea id="program-chat-question" rows={2} minLength={2} maxLength={1000} value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder={awaitingProgramDetail ? "Reply or skip this question…" : "Ask about this program…"} disabled={Boolean(chatLoadingId)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void askProgramQuestion(); } }} />
            <button type="submit" disabled={Boolean(chatLoadingId) || chatInput.trim().length < 2} aria-label="Send question"><b aria-hidden="true">↑</b></button>
          </form>
        </aside>
      </div>}

      </main>
      {applicationNotice && <aside className="application-handoff" role="status" aria-live="polite"><BrandLogo size={48} /><div><strong>{extensionReady ? "BenefitBeacon can continue with you" : "Keep BenefitBeacon beside you"}</strong><p>{applicationNotice}</p></div><button type="button" onClick={() => setApplicationNotice("")} aria-label="Dismiss application guide message">×</button></aside>}
      <footer><span>BenefitBeacon</span><p>Built for clarity, privacy, and local impact.</p><a href="mailto:benefitbeacon@example.org">Report an error ↗</a></footer>
    </div>
  );
}
