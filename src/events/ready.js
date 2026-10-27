/**
 * Événement ready - Se déclenche lorsque le client Discord est authentifié et connecté à la Gateway.
 */
import { Events, ActivityType } from "discord.js";
import { logger } from "../utils/logger.js";
import { channelStore } from "../services/channelStore.js";

export const name = Events.ClientReady;
export const once = true;

/**
 * @param {import('discord.js').Client} client
 */
export async function execute(client) {
  logger.info(`=======================================================`);
  logger.info(`🤖 Connecté avec succès en tant que : ${client.user.tag} (ID: ${client.user.id})`);
  logger.info(`🏰 Serveurs connectés : ${client.guilds.cache.size}`);

  // Affichage du statut du salon de relais
  const channelMeta = channelStore.getMetadata();
  if (channelMeta.isConfigured) {
    const channel = client.channels.cache.get(channelMeta.channelId);
    if (channel) {
      logger.info(`🎯 Salon de relais actif : #${channel.name} (ID: ${channel.id}) sur "${channel.guild.name}"`);
    } else {
      logger.warn(`⚠️ Salon de relais configuré (${channelMeta.channelId}) mais introuvable dans le cache.`);
    }
  } else {
    logger.warn(`⚠️ Aucun salon de relais n'est actuellement configuré.`);
    logger.warn(`👉 Utilisez la commande /setchannel sur votre serveur pour désigner le salon.`);
  }

  // Définition de la présence / activité du bot
  client.user.setPresence({
    activities: [
      {
        name: "Relais MP ↔ Salon | /help",
        type: ActivityType.Custom
      }
    ],
    status: "online"
  });

  logger.info(`🚀 YouPulse Bot est prêt et à l'écoute des événements !`);
  logger.info(`=======================================================`);
}
