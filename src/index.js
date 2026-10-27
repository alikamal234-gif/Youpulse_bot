/**
 * Point d'entrée principal du bot Discord YouPulse.
 */
import http from "node:http";
import {
  Client,
  GatewayIntentBits,
  Partials
} from "discord.js";
import { config, validateConfig } from "./config.js";
import { logger } from "./utils/logger.js";
import { getCommandsMap } from "./commands/index.js";
import * as readyEvent from "./events/ready.js";
import * as messageCreateEvent from "./events/messageCreate.js";
import * as interactionCreateEvent from "./events/interactionCreate.js";

// 1. Validation stricte de la configuration au démarrage (Fail-fast)
validateConfig(true);

logger.info("Démarrage de YouPulse Bot...");

// 2. Initialisation du client Discord avec les intents minimaux requis et les partials
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Channel, // Indispensable pour capter les événements de messages privés (DMs)
    Partials.Message,
    Partials.User
  ]
});

// 3. Chargement des commandes dans l'instance du client
client.commands = getCommandsMap();
logger.info(`${client.commands.size} commande(s) slash chargée(s) en mémoire.`);

// 4. Enregistrement des gestionnaires d'événements
client.once(readyEvent.name, (...args) => readyEvent.execute(...args));
client.on(messageCreateEvent.name, (...args) => messageCreateEvent.execute(...args));
client.on(interactionCreateEvent.name, (...args) => interactionCreateEvent.execute(...args));

// 5. Serveur HTTP de surveillance de santé (Optionnel / Hébergement Cloud type Koyeb, Render)
let httpServer = null;
if (config.port) {
  httpServer = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "healthy",
          bot: client.user ? client.user.tag : "connecting",
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        })
      );
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    }
  });

  httpServer.listen(config.port, () => {
    logger.info(`Serveur HTTP de santé en écoute sur le port ${config.port} (Endpoint /health)`);
  });
}

// 6. Gestion des arrêts gracieux (SIGINT / SIGTERM)
let isShuttingDown = false;

async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Signal ${signal} reçu. Arrêt gracieux du bot en cours...`);

  if (httpServer) {
    httpServer.close(() => {
      logger.info("Serveur HTTP fermé.");
    });
  }

  try {
    client.destroy();
    logger.info("Connexion Discord Gateway fermée avec succès.");
  } catch (err) {
    logger.error("Erreur lors de la fermeture du client Discord :", err);
  }

  process.exit(0);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

// 7. Filets de sécurité pour les rejets de promesse et exceptions non capturées
process.on("unhandledRejection", (reason) => {
  logger.error("Rejet de promesse non géré (UnhandledRejection) :", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Exception non capturée (UncaughtException) :", error);
});

// 8. Connexion à la Gateway Discord
client.login(config.token).catch((err) => {
  logger.error("❌ Échec de connexion à la Gateway Discord :", err.message);
  if (err.message?.includes("disallowed intents")) {
    logger.error("🚨 ATTENTION : 'Message Content Intent' n'est pas activé dans votre portail développeur Discord !");
    logger.error(`👉 Rendez-vous sur : https://discord.com/developers/applications/${config.clientId}/bot`);
    logger.error("👉 Faites défiler jusqu'à 'Privileged Gateway Intents' et activez la case 'Message Content Intent'.");
    logger.error("👉 Cliquez sur 'Save Changes' puis relancez le bot.");
  } else {
    logger.error("Vérifiez la validité de votre DISCORD_TOKEN dans le fichier .env");
  }
  process.exit(1);
});
