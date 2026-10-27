/**
 * Script de déploiement et enregistrement des commandes slash auprès de l'API Discord REST.
 * 
 * Usage :
 *   node scripts/deploy-commands.js          (déploiement global ou guild selon DISCORD_GUILD_ID)
 *   npm run deploy-commands
 */
import { REST, Routes } from "discord.js";
import { config, validateConfig } from "../src/config.js";
import { commands } from "../src/commands/index.js";
import { logger } from "../src/utils/logger.js";

// Validation préalable de la configuration
const validation = validateConfig(false);
if (!validation.valid) {
  logger.error("Impossible de déployer les commandes : la configuration est invalide :");
  validation.errors.forEach((err) => logger.error(`  - ${err}`));
  process.exit(1);
}

const commandsData = commands.map((cmd) => cmd.data.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);

async function deploy() {
  try {
    logger.info(`Début de l'enregistrement de ${commandsData.length} commande(s) slash...`);

    if (config.guildId) {
      // Nettoyage des commandes globales pour éviter les doublons d'affichage
      logger.info("Suppression des commandes globales pour éviter la duplication...");
      await rest.put(Routes.applicationCommands(config.clientId), { body: [] });

      // Déploiement spécifique à un serveur (instantané pour les tests / dev)
      logger.info(`Mode Serveur : Enregistrement sur le serveur ID : ${config.guildId}`);
      const data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commandsData }
      );
      logger.info(`✅ ${data.length} commande(s) enregistrée(s) avec succès sur le serveur (${config.guildId}) !`);
    } else {
      // Déploiement global (visible sur tous les serveurs et en MP)
      logger.info("Mode Global : Enregistrement sur l'ensemble de l'application Discord...");
      const data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commandsData }
      );
      logger.info(`✅ ${data.length} commande(s) globale(s) enregistrée(s) avec succès !`);
      logger.info("ℹ️ Les commandes globales peuvent prendre quelques minutes à se propager sur tous les serveurs.");
    }

    logger.info("Liste des commandes enregistrées :");
    commands.forEach((c) => {
      logger.info(`  • /${c.data.name} — ${c.data.description} ${c.ownerOnly ? "(🔒 Propriétaire)" : "(🌐 Public)"}`);
    });
  } catch (error) {
    logger.error("❌ Erreur lors du déploiement des commandes :", error);
    process.exit(1);
  }
}

deploy();
