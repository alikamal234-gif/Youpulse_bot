/**
 * Module de journalisation sécurisé et formaté.
 * Filtre automatiquement les secrets (tokens, clés) pour éviter toute fuite.
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevelName = (process.env.LOG_LEVEL || "info").toLowerCase();
const currentLevel = LOG_LEVELS[currentLevelName] ?? LOG_LEVELS.info;

/**
 * Nettoie une chaîne pour masquer les tokens ou secrets Discord éventuels.
 * @param {string} text
 * @returns {string}
 */
export function sanitize(text) {
  if (typeof text !== "string") {
    return text;
  }
  // Masque les tokens Discord typiques (ex: [A-Za-z0-9_-]{24,28}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,})
  let sanitized = text.replace(
    /[A-Za-z0-9_-]{24,28}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/g,
    "[REDACTED_DISCORD_TOKEN]"
  );

  // Masque également le token configuré dans l'environnement s'il est présent
  const envToken = process.env.DISCORD_TOKEN;
  if (envToken && envToken.length > 5) {
    sanitized = sanitized.replaceAll(envToken, "[REDACTED_DISCORD_TOKEN]");
  }

  return sanitized;
}

/**
 * Formate un message de log avec timestamp ISO et niveau.
 * @param {string} level
 * @param {string} message
 * @param {any[]} args
 */
function logMessage(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const sanitizedMsg = sanitize(typeof message === "string" ? message : String(message));
  const sanitizedArgs = args.map((arg) => {
    if (arg instanceof Error) {
      arg.message = sanitize(arg.message);
      if (arg.stack) arg.stack = sanitize(arg.stack);
      return arg;
    }
    if (typeof arg === "string") {
      return sanitize(arg);
    }
    return arg;
  });

  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  switch (level) {
    case "error":
      console.error(`${prefix} ${sanitizedMsg}`, ...sanitizedArgs);
      break;
    case "warn":
      console.warn(`${prefix} ${sanitizedMsg}`, ...sanitizedArgs);
      break;
    case "debug":
      console.debug(`${prefix} ${sanitizedMsg}`, ...sanitizedArgs);
      break;
    case "info":
    default:
      console.log(`${prefix} ${sanitizedMsg}`, ...sanitizedArgs);
      break;
  }
}

export const logger = {
  debug: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.debug) {
      logMessage("debug", message, ...args);
    }
  },
  info: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.info) {
      logMessage("info", message, ...args);
    }
  },
  warn: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.warn) {
      logMessage("warn", message, ...args);
    }
  },
  error: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.error) {
      logMessage("error", message, ...args);
    }
  }
};
