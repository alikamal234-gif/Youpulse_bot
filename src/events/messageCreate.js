/**
 * Événement messageCreate - Route les messages entrants vers le service de relais.
 */
import { Events, ChannelType } from "discord.js";
import { relayDmToChannel, relayChannelToDm } from "../services/messageRelay.js";
import { logger } from "../utils/logger.js";

export const name = Events.MessageCreate;
export const once = false;

/**
 * @param {import('discord.js').Message} message
 */
export async function execute(message) {
  try {
    // Cas 1 : Message Privé (DM)
    if (!message.guild || message.channel.type === ChannelType.DM) {
      // Ignorer les messages envoyés par le bot lui-même en MP
      if (message.author.id === message.client.user.id) {
        return;
      }
      logger.info(`[MessageCreate:DM] Reçu de ${message.author.tag} : "${message.content}"`);
      await relayDmToChannel(message, message.client);
      return;
    }

    // Cas 2 : Message dans un salon de serveur
    if (message.author.id === message.client.user.id) {
      return;
    }
    await relayChannelToDm(message, message.client);
  } catch (err) {
    logger.error("[Event:messageCreate] Erreur non gérée lors du traitement du message :", err);
  }
}
