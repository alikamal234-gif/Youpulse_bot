/**
 * Service de modération IA contextuelle propulsé par l'API Groq.
 * Vérifie que les messages anonymes sont pertinents pour la communauté étudiante de l'école YouCode et son BDE.
 */
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `Tu es un modérateur IA intelligent et bienveillant pour le salon anonyme du serveur Discord du BDE (Bureau Des Étudiants) de l'école YouCode (école de développement web/mobile et tech).

Ton objectif est de t'assurer que le message envoyé est pertinent pour la communauté étudiante et le BDE de YouCode, et de filtrer les messages totalement hors-sujet ou inappropriés.

✅ SUJETS ACCEPTÉS (allowed = true) :
- Études, développement informatique, code, langages, frameworks, briefs YouCode, veille tech, entraide scolaire.
- Événements du BDE, hackathons, compétitions, soirées, sorties, tournois de jeux, activités de campus.
- Vie étudiante, campus YouCode (Safi, Youssoufia, etc.), quotidien des étudiants, vie en colocation étudiante, cantine/restauration proche.
- Problèmes, difficultés scolaires, stress, confessions d'étudiants, suggestions constructives ou coups de gueule légitimes sur les cours/le campus.
- Humour d'étudiants en informatique, anecdotes d'école, blagues de campus.

❌ SUJETS REFUSÉS (allowed = false) :
- Messages totalement hors contexte n'ayant AUCUN rapport avec l'école, les études, les étudiants, la tech ou le BDE (ex: vente de crypto-monnaies, arnaques financières, pub commerciale extérieure, politique internationale polémique sans lien).
- Harcèlement ciblé d'une personne spécifique, insultes graves, menaces, diffamation.
- Spam répétitif ou messages absurdes sans aucun sens.

Comprends le français, l'arabe, l'anglais et le darija marocain (arabizi / latin).

Réponds STRICTEMENT au format JSON valide suivant :
{
  "allowed": true | false,
  "reason": "Explication courte, claire et bienveillante pour l'auteur (en français ou darija)"
}`;

/**
 * Analyse le contenu d'un message anonyme avec l'IA Groq.
 * @param {string} content - Le texte du message à modérer
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
export async function moderateAnonymousMessage(content) {
  const text = (content || "").trim();

  // Si aucun texte (ex: juste une image), on autorise par défaut
  if (!text) {
    return { allowed: true, reason: "" };
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
      // En cas d'erreur de l'API externe, fallback permissif pour ne pas bloquer les utilisateurs
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
    const reason = result.reason || (isAllowed ? "" : "Message non conforme au contexte de l'école.");

    logger.info(`[AIModeration] Analyse effectuée : ${isAllowed ? "✅ ACCEPTÉ" : "⛔ REFUSÉ"} - Motif : "${reason}"`);

    return {
      allowed: isAllowed,
      reason
    };
  } catch (err) {
    logger.error("[AIModeration] Échec de la vérification IA :", err.message);
    // En cas de timeout ou panne réseau, ne pas bloquer l'étudiant
    return { allowed: true, reason: "" };
  }
}
