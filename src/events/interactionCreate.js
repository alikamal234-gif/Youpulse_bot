import { Events, MessageFlags } from "discord.js";
import { handleSelectChannelInteraction, isUserAdminOrOwner } from "../services/messageRelay.js";
import { logger } from "../utils/logger.js";

export const name = Events.InteractionCreate;
export const once = false;

/**
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
  // 1. Gestion des menus déroulants (Select Menus)
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith("select_channel_")) {
      await handleSelectChannelInteraction(interaction);
      return;
    }
  }

  // 2. Gestion des commandes slash
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    logger.warn(`[Event:interactionCreate] Commande inconnue reçue : /${interaction.commandName}`);
    return interaction.reply({
      content: "❌ Cette commande n'est plus disponible sur ce bot.",
      flags: MessageFlags.Ephemeral
    }).catch(() => {});
  }

  // Vérification de sécurité pour les commandes réservées aux administrateurs / propriétaire
  if (command.ownerOnly) {
    const isAllowed = await isUserAdminOrOwner(interaction.user.id, interaction.client);
    if (!isAllowed) {
      logger.warn(`[Security] Tentative d'exécution de /${interaction.commandName} par un utilisateur non autorisé : ${interaction.user.tag} (${interaction.user.id})`);
      return interaction.reply({
        content: "⛔ **Accès refusé** : Cette commande administrative est réservée au propriétaire et aux administrateurs (rôle Admin).",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    logger.error(`[Command:${interaction.commandName}] Erreur d'exécution :`, err);

    const errorMessage = "❌ Une erreur interne est survenue lors de l'exécution de la commande.";

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    } catch (replyErr) {
      logger.error("[Event:interactionCreate] Impossible d'envoyer le message d'erreur :", replyErr.message);
    }
  }
}
