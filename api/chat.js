// Crew chat for "Junior Astronaut: Outpost".
// The browser sends the crew member, language, a few base numbers and the chat so far;
// this function asks Claude to answer in that crew member's role. The API key stays here
// (Vercel env var ANTHROPIC_API_KEY) and never reaches the page.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const CREW = [
  { ru: "Аня, бортинженер", en: "Anya, the flight engineer", job: "power, solar panels, batteries, the reactor, repairs, the rover and spacesuits" },
  { ru: "Тимур, врач экипажа", en: "Timur, the crew doctor", job: "health, radiation dose, sleep, exercise, food and water for the body" },
  { ru: "Лина, биолог", en: "Lina, the biologist", job: "the greenhouse, plants, oxygen, water recycling and science samples" },
];

// Small in-memory limiter per warm instance: enough to stop a single page from spamming.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 60_000, max = 12;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now); hits.set(ip, list);
  return list.length > max;
}

const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : null);

function systemPrompt(k, lang, st) {
  const c = CREW[k];
  const ru = lang !== "en";
  const planet = st.planet === "mars" ? (ru ? "Марс" : "Mars") : (ru ? "Луна" : "the Moon");
  const facts = [
    `planet: ${planet}`,
    st.day != null ? `day ${st.day} of ${st.days ?? "?"}` : null,
    st.o2 != null ? `base oxygen ${st.o2} kg` : null,
    st.battery != null ? `battery ${st.battery}/${st.batCap ?? "?"} kWh` : null,
    st.water != null ? `water ${st.water} kg` : null,
    st.food != null ? `food ${st.food} kg` : null,
    st.health != null ? `crew health ${st.health}%` : null,
    st.dose != null ? `radiation dose ${st.dose} mSv` : null,
    st.science != null ? `science delivered to Earth ${st.science}` : null,
    st.panels != null ? `${st.panels} solar panels` : null,
    st.reactor ? "a small fission reactor is running" : null,
    st.storm ? "a solar proton storm is happening today" : null,
  ].filter(Boolean).join("; ");
  return `You are ${ru ? c.ru : c.en}, a crew member of a small outpost in an educational game for children aged 7 to 12, made for the NASA Space Apps Challenge. You look after ${c.job}. The person talking to you is the base commander: a child.

Current state of the base: ${facts}.

How to answer:
- Reply in ${ru ? "Russian" : "English"}, in 1 to 4 short, friendly sentences a 9-year-old understands.
- Answer every question, including ones that have nothing to do with space: arithmetic (for "2+2" say "4"), homework, animals, everyday things. Get facts and sums right; if you are not sure, say so.
- When it fits, connect the answer to life on the base or real NASA science (Artemis, the ISS, Mars rovers), and give a useful tip from the numbers above.
- Stay in your role; never say you are an AI model unless asked directly.
- Keep it safe for children: no scary, violent or adult content, no personal data. If asked for something unsuitable, kindly change the subject.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "POST only" }); }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "not configured" });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (limited(ip)) return res.status(429).json({ error: "too many requests" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const k = Number.isInteger(body.crew) && body.crew >= 0 && body.crew < CREW.length ? body.crew : 0;
  const lang = body.lang === "en" ? "en" : "ru";
  const s = body.state || {};
  const st = {
    planet: s.planet === "mars" ? "mars" : "moon",
    day: num(s.day, 0, 100), days: num(s.days, 0, 100), o2: num(s.o2, 0, 10000), battery: num(s.battery, 0, 10000), batCap: num(s.batCap, 0, 10000),
    water: num(s.water, 0, 10000), food: num(s.food, 0, 10000), health: num(s.health, 0, 100), dose: num(s.dose, 0, 100000),
    science: num(s.science, 0, 1000), panels: num(s.panels, 0, 100), reactor: !!s.reactor, storm: !!s.storm,
  };
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "no question" });

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: systemPrompt(k, lang, st),
      messages,
    });
    if (response.stop_reason === "refusal") {
      return res.status(200).json({ text: lang === "en" ? "Let's talk about something else! Ask me about the base or anything you are curious about." : "Давай поговорим о чём-нибудь другом! Спроси меня про базу или про что угодно интересное." });
    }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return res.status(200).json({ text });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "busy" });
    if (err instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: "bad key" });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: "upstream " + err.status });
    return res.status(500).json({ error: "server error" });
  }
}
