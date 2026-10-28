/**
 * Service de modération IA contextuelle propulsé par l'API Groq.
 * Vérifie que les messages anonymes respectent strictement le contexte de l'école YouCode & du BDE,
 * et applique une tolérance zéro contre toute forme d'insulte, juron ou vulgarité (sbaan),
 * y compris en darija marocain, français, anglais ou arabe.
 */
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";

// Expressions et termes grossiers / insultes interdits (garde-fou instantané)
const PROFANITY_REGEX = /(?:^|\s|[^a-zA-Z0-9\u0600-\u06FF])(?:t9[o0]?w[e3]d|t9[o0]?w[e3]r|m9[e3]w[e3]d|mq[e3]w[e3]d|tq[o0]?w[e3]d|q[o0]?w[e3]d|zb[bi]?|z[e3]b[bi]?|9l[a4]w[iy]|ql[a4]w[iy]|tb[o0]+n|t[a4]b[o0]+n|9[a4]?[7h]b[a4]|q[a4]?[7h]b[a4]|k[a4]hb[a4]|w[e3]ld?\s*l?9[a4]?[7h]b[a4]|t7w[a4]|thw[a4]|7w[a4]y|n[i1e]k|n[e3]k|mn[i1e]k|mn[i1e]y[e3]k|7m[a4]r|hm[a4]r|k[e3]lb|klb|t?khr[a4]|khry[a4]|pute|salope|connard|batard|encule|putain|nique|fdp|fuck|bitch|cunt|asshole|motherfucker|dick|قواد|تقود|مكود|قحبة|زبي|قلاوي|طبون|تحوى|نيك|كلب|حمار|تخرا|خرا)(?:$|\s|[^a-zA-Z0-9\u0600-\u06FF])/i;

const SYSTEM_PROMPT = `Tu es le modérateur IA bienveillant mais vigilant du salon anonyme Discord pour la communauté étudiante de l'école YouCode et son BDE (Bureau Des Étudiants).

Ton objectif est de maintenir un espace d'échange convivial, ouvert et respectueux pour les étudiants, sans être excessivement rigide ni bloquer les interactions normales.

✅ CE QUI EST PLEINEMENT ACCEPTÉ (allowed = true) :
- Les salutations et formules de politesse simples ou amicales : "hello", "salam", "salut ldrary", "bonjour tout le monde", "cv l-drary", etc.
- Les questions normales, quotidiennes ou générales entre membres : demandes de conseils, avis, questions de curiosité, partage d'idées, discussions amicales.
- Tout ce qui concerne l'école YouCode, les études, les briefs, les projets, le code, la tech, l'entraide scolaire.
- Toutes les activités du BDE, hackathons, tournois de jeux (FIFA, etc.), événements, clubs, sorties.
- La vie sur le campus (Safi, Youssoufia), colocation, restauration, anecdotes d'école, humour bon enfant d'étudiants.
- Les confessions étudiantes, retours d'expérience, coups de cœur ou questions existentielles d'étudiants.

❌ CE QUI EST STRICTEMENT REFUSÉ (allowed = false) :
1. TOLÉRANCE ZÉRO POUR LES INSULTES ET GROS MOTS (SBAAN / VULGARITÉ) :
   - Tout terme vulgaire, insulte ou juron, quelle que soit la langue (Darija : t9owed, sir t9owed, zbi, 9lawi, tbon, 97ba, wld l97ba, t7wa, khra, etc. ; Français : merde, putain, nique, connard, etc. ; Anglais : fuck, shit, bitch, etc. ; Arabe).
   - Harcèlement ciblé, menaces ou propos haineux.
2. SPAM COMMERCIAL ET ARNAQUES :
   - Vente de produits extérieurs sans rapport (motos, voitures, etc.), arnaques crypto, publicités commerciales externes non sollicitées.

RÈGLE : Sois accueillant et ouvert pour les messages normaux et polis (salutations, questions de la vie quotidienne), mais intraitable sur le respect (zéro insulte/sbaan) et l'absence de spam commercial.

Réponds STRICTEMENT au format JSON valide suivant :
{
  "allowed": true | false,
  "reason": "Explication courte et claire (en français ou darija)"
}`;

/**
 * Vérifie si le texte contient une insulte ou un gros mot évident.
 * @param {string} text
 * @returns {boolean}
 */
export function hasProfanity(text) {
  if (!text || typeof text !== "string") return false;
  return PROFANITY_REGEX.test(text);
}

/**
 * Analyse le contenu d'un message anonyme avec l'IA Groq et les filtres contextuels.
 * @param {string} content - Le texte du message à modérer
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
export async function moderateAnonymousMessage(content) {
  const text = (content || "").trim();

  // Si aucun texte (ex: juste une image), on autorise par défaut
  if (!text) {
    return { allowed: true, reason: "" };
  }

  // 1. Filtrage instantané des insultes et vulgarités évidentes (Sbaan)
  if (hasProfanity(text)) {
    logger.info(`[AIModeration] ⛔ Refus immédiat (insulte/sbaan détecté) : "${text.slice(0, 50)}..."`);
    return {
      allowed: false,
      reason: "Le message contient des insultes ou des propos vulgaires (Sbaan), strictement interdits sur le serveur."
    };
  }

  // Si aucune clé Groq n'est configurée, laisser passer en consignant un avertissement
  if (!config.groqApiKey) {
    logger.warn("[AIModeration] GROQ_API_KEY non configurée. Modération IA désactivée.");
    return { allowed: true, reason: "" };
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error(`[AIModeration] Erreur API Groq (${response.status}) :`, errText);
      return { allowed: true, reason: "" };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      logger.warn("[AIModeration] Réponse vide de Groq.");
      return { allowed: true, reason: "" };
    }

    const result = JSON.parse(rawContent);
    const isAllowed = Boolean(result.allowed);
    const reason = result.reason || (isAllowed ? "" : "Message non conforme au contexte de l'école ou du BDE.");

    logger.info(`[AIModeration] Analyse effectuée : ${isAllowed ? "✅ ACCEPTÉ" : "⛔ REFUSÉ"} - Motif : "${reason}"`);

    return {
      allowed: isAllowed,
      reason
    };
  } catch (err) {
    logger.error("[AIModeration] Échec de la vérification IA :", err.message);
    return { allowed: true, reason: "" };
  }
}
