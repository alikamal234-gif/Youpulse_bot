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
const PROFANITY_REGEX = /\b(zbi|zbbi|9lawi|qlaoui|tbon|tbboun|97ba|qahba|l97ba|kahba|t7wa|thwa|nik|nek|7mar|hmar|klb|kelb|khra|weld\s*l97ba|wld\s*l97ba|m9ewed|mqewed|pute|salope|connard|batard|encule|putain|nique|fdp|fuck|bitch|cunt|asshole|motherfucker|قحبة|كلب|حمار|منيك|زب)\b/i;

const SYSTEM_PROMPT = `Tu es le modérateur IA strict du salon anonyme Discord pour le BDE (Bureau Des Étudiants) et les étudiants de l'école YouCode (école de développement informatique).

Ta mission est double et SANS COMPROMIS :

1. RESPECT STRICT DU CONTEXTE BDE & ÉCOLE :
   Le message DOIT être directement lié à l'école YouCode, ses activités, ses étudiants ou son BDE.
   Sont STRICTEMENT ACCEPTÉS (allowed = true) :
   - Activités du BDE, événements, tournois, soirées d'intégration, sorties, hackathons, clubs de l'école.
   - Études à YouCode, briefs, projets, coding, technologies, entraide scolaire, questions techniques.
   - Vie sur le campus YouCode (Safi, Youssoufia), cantine/restauration proche, vie étudiante collective.
   - Problèmes ou suggestions constructifs concernant l'école ou les activités du BDE.

   Sont REFUSÉS (allowed = false) :
   - Tout message HORS SUJET n'ayant aucun lien avec l'école, le BDE ou les études (ex: vente de motos/voitures, football pro extérieur, politique, crypto, commerce externe, bavardage personnel sans rapport).

2. TOLÉRANCE ZÉRO POUR LES INSULTES ET GROS MOTS (SBAAN / سب وقذف / VULGARITÉS) :
   AUCUN gros mot, insulte, juron, vulgarité ou terme offensant n'est toléré, QUELLE QUE SOIT LA LANGUE :
   - En DARIJA MAROCAIN (latin/arabizi ou arabe) : INTERDICTION TOTALE des insultes, sbaan, mots vulgaires ou grossiers (ex: zbi, 9lawi, tbon, 97ba, wld l97ba, 7mar, kelb, t7wa, khra, nik, m9ewed employé vulgairement, etc.).
   - En FRANÇAIS : INTERDICTION TOTALE des jurons et insultes (merde, putain, nique, connard, batard, fdp, salope, etc.).
   - En ANGLAIS : INTERDICTION TOTALE (fuck, shit, bitch, cunt, asshole, dick, etc.).
   - En ARABE : INTERDICTION TOTALE de tout mot vulgaire ou insulte.

   ⚠️ RÈGLE D'OR : Même si le message parle de l'école ou du BDE, s'il contient LE MOINDRE gros mot ou insulte (même légère ou familière), il DOIT ÊTRE REFUSÉ (allowed = false).

Réponds STRICTEMENT au format JSON valide suivant :
{
  "allowed": true | false,
  "reason": "Explication courte et claire du refus ou de l'acceptation (en français ou darija)"
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
