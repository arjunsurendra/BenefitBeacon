import type { IncomeBand, UserProfile } from "@/lib/types";

function incomeBandFromAmount(amount: number): IncomeBand {
  if (amount < 25_000) return "under25k";
  if (amount < 50_000) return "25-50k";
  if (amount < 80_000) return "50-80k";
  if (amount < 120_000) return "80-120k";
  return "over120k";
}

export function extractLocally(raw: string): { profile: UserProfile; confidence: number } {
  const text = raw.toLowerCase();
  const profile: UserProfile = {};
  const zip = text.match(/\b9\d{4}\b/)?.[0];
  if (zip) profile.zip = zip;
  if (/sunnyvale/.test(text) || zip?.startsWith("9408")) profile.city = "sunnyvale";
  else if (/san jose/.test(text)) profile.city = "san jose";
  else if (/santa clara/.test(text)) profile.city = "santa clara";
  else if (/mountain view/.test(text)) profile.city = "mountain view";
  if (profile.city || /california|\bca\b/.test(text)) profile.state = "CA";

  const age = Number(text.match(/\b(?:i am|i'm|age)\s+(\d{1,3})\b/)?.[1]);
  if (age) {
    profile.ageRange = age < 18 ? "under18" : age < 25 ? "18-24" : age < 55 ? "25-54" : age < 62 ? "55-61" : age < 65 ? "62-64" : "65plus";
  } else if (/senior|retired|over 65/.test(text)) profile.ageRange = "65plus";

  const household = Number(text.match(/(?:household|family)\s+(?:of\s+)?(\d+)/)?.[1]);
  if (household) profile.householdSize = household;

  const childAges = [...text.matchAll(/(?:child|kid|son|daughter)(?:ren)?(?:\s+(?:is|are|ages?|aged))?\s+(\d{1,2})/g)].map((match) => Number(match[1]));
  if (childAges.length) profile.childrenAges = childAges;
  else if (/baby|infant|toddler/.test(text)) profile.childrenAges = [2];
  else if (/two kids|2 kids|two children|2 children/.test(text)) profile.childrenAges = [8, 12];
  else if (/child|kid|son|daughter/.test(text)) profile.childrenAges = [10];

  const amountMatch = text.match(/\$?([1-9]\d{1,2})(?:,?000|k)\b/);
  if (amountMatch) profile.incomeBand = incomeBandFromAmount(Number(amountMatch[1]) * 1000);
  else if (/low[- ]income|struggling|can't afford|cannot afford/.test(text)) profile.incomeBand = "under25k";
  else if (/under\s*\$?25/.test(text)) profile.incomeBand = "under25k";

  if (/\brent(?:er|ing)?\b/.test(text)) profile.housing = "rent";
  else if (/homeowner|own (?:my|our|a) home|own a house/.test(text)) profile.housing = "own";
  else if (/unhoused|homeless/.test(text)) profile.housing = "unhoused";

  if (/veteran|served in the military|former military/.test(text)) profile.veteran = true;
  if (/active duty|active-duty/.test(text)) profile.activeDuty = true;
  if (/disabled|disability/.test(text)) profile.disabled = true;
  if (/caregiver|care for my/.test(text)) profile.caregiver = true;
  if (/unemployed|lost my job|between jobs/.test(text)) profile.employment = "unemployed";
  else if (/retired/.test(text)) profile.employment = "retired";
  else if (/student/.test(text)) profile.employment = "student";
  else if (/work full|employed|working/.test(text)) profile.employment = "employed";
  if (/high (?:water|utility|energy) bill|bill is high|behind on (?:my )?(?:water|utility|energy) bill/.test(text)) profile.hasHighWaterBill = true;

  const interests: string[] = [];
  if (/water|utility|energy|electric|gas/.test(text)) interests.push("water");
  if (/repair|weatheriz|renovat|home improvement/.test(text)) interests.push("home repair");
  if (/landscap|lawn|garden/.test(text)) interests.push("landscape");
  if (/child care|daycare/.test(text)) interests.push("child care");
  if (/food|grocer|meal/.test(text)) interests.push("food");
  if (interests.length) profile.interests = interests;

  const captured = Object.keys(profile).length;
  return { profile, confidence: Math.min(0.88, 0.32 + captured * 0.075) };
}
