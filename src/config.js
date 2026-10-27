/**
 * Module de gestion et validation de la configuration de l'application.
 */
import dotenv from "dotenv";

// Charge les variables d'environnement depuis le fichier .env
dotenv.config();

const PLACEHOLDER_PREFIXES = ["votre_", "your_", "123456789"];

/**
 * Vérifie si une valeur ressemble à un placeholder d'exemple.
 * @param {string} val
 * @returns {boolean}
 */
function isPlaceholder(val) {
  if (!val) return true;
  return PLACEHOLDER_PREFIXES.some((prefix) => val.startsWith(prefix));
}

/**
 * Valide si une chaîne est un identifiant Discord (snowflake) valide.
 * Les flocons Discord sont des entiers non signés de 17 à 20 chiffres.
 * @param {string} id
 * @returns {boolean}
 */
export function isValidSnowflake(id) {
  return typeof id === "string" && /^\d{17,20}$/.test(id);
}

/**
 * Valide l'ensemble des variables d'environnement nécessaires au bon fonctionnement du bot.
 * @param {boolean} exitOnError - Si vrai, stoppe le processus en cas d'erreur de configuration.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfig(exitOnError = true) {
  const errors = [];

  const token = process.env.DISCORD_TOKEN?.trim();
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const ownerId = process.env.DISCORD_OWNER_ID?.trim();
  const defaultChannelId = process.env.DISCORD_CHANNEL_ID?.trim();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();

  // Validation du token
  if (!token) {
    errors.push("DISCORD_TOKEN est absent dans l'environnement (.env).");
  } else if (isPlaceholder(token)) {
    errors.push("DISCORD_TOKEN contient une valeur d'exemple ('votre_token_secret_ici'). Renseignez un vrai token.");
  }

  // Validation du client ID
  if (!clientId) {
    errors.push("DISCORD_CLIENT_ID est absent dans l'environnement (.env).");
  } else if (!isValidSnowflake(clientId)) {
    errors.push(`DISCORD_CLIENT_ID '${clientId}' n'est pas un identifiant Discord valide (17-20 chiffres attendus).`);
  }

  // Validation du propriétaire
  if (!ownerId) {
    errors.push("DISCORD_OWNER_ID est absent dans l'environnement (.env).");
  } else if (!isValidSnowflake(ownerId)) {
    errors.push(`DISCORD_OWNER_ID '${ownerId}' n'est pas un identifiant Discord valide (17-20 chiffres attendus).`);
  }

  // Vérification optionnelle du salon par défaut
  if (defaultChannelId && !isValidSnowflake(defaultChannelId)) {
    errors.push(`DISCORD_CHANNEL_ID '${defaultChannelId}' est fourni mais n'est pas un identifiant Discord valide.`);
  }

  // Vérification optionnelle du guild ID
  if (guildId && !isValidSnowflake(guildId)) {
    errors.push(`DISCORD_GUILD_ID '${guildId}' est fourni mais n'est pas un identifiant Discord valide.`);
  }

  if (errors.length > 0 && exitOnError) {
    console.error("❌ ERREUR DE CONFIGURATION :");
    errors.forEach((err) => console.error(`  - ${err}`));
    console.error("\nVeuillez configurer votre fichier .env correctement avant de lancer le bot.");
    console.error("Consultez .env.example pour un modèle de configuration.");
    process.exit(1);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export const config = Object.freeze({
  token: process.env.DISCORD_TOKEN?.trim() || "",
  clientId: process.env.DISCORD_CLIENT_ID?.trim() || "",
  ownerId: process.env.DISCORD_OWNER_ID?.trim() || "",
  defaultChannelId: process.env.DISCORD_CHANNEL_ID?.trim() || null,
  guildId: process.env.DISCORD_GUILD_ID?.trim() || null,
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : null,
  logLevel: (process.env.LOG_LEVEL || "info").toLowerCase(),
  groqApiKey: process.env.GROQ_API_KEY?.trim() || ""
});
