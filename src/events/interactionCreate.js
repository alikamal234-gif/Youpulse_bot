/**
 * Événement interactionCreate - Route et exécute les commandes slash.
 */
import { Events } from "discord.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export const name = Events.InteractionCreate;
export const once = false;

/**
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    logger.warn(`[Event:interactionCreate] Commande inconnue reçue : /${interaction.commandName}`);
    return interaction.reply({
      content: "❌ Cette commande n'est plus disponible sur ce bot.",
      ephemeral: true
    }).catch(() => {});
  }

  // Vérification de sécurité pour les commandes réservées au propriétaire
  if (command.ownerOnly && interaction.user.id !== config.ownerId) {
    logger.warn(`[Security] Tentative d'exécution de /${interaction.commandName} par un utilisateur non autorisé : ${interaction.user.tag} (${interaction.user.id})`);
    return interaction.reply({
      content: "⛔ **Accès refusé** : Vous n'êtes pas autorisé à utiliser cette commande administrative.",
      ephemeral: true
    }).catch(() => {});
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    logger.error(`[Command:${interaction.commandName}] Erreur d'exécution :`, err);

    const errorMessage = "❌ Une erreur interne est survenue lors de l'exécution de la commande.";

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (replyErr) {
      logger.error("[Event:interactionCreate] Impossible d'envoyer le message d'erreur :", replyErr.message);
    }
  }
}
