/**
 * Commande /unsetchannel - Supprime ou désactive le salon de relais configuré (l'inverse de /setchannel).
 * Réservée au propriétaire autorisé.
 */
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { channelStore } from "../services/channelStore.js";
import { logger } from "../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("unsetchannel")
  .setDescription("Supprime le salon de relais configuré (désactive le relais vers/depuis le salon).");

export const ownerOnly = true;

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  // 1. Vérification de sécurité propriétaire
  if (interaction.user.id !== config.ownerId) {
    logger.warn(`[Command:unsetchannel] Tentative non autorisée par ${interaction.user.tag} (${interaction.user.id})`);
    return interaction.reply({
      content: "⛔ **Accès refusé** : Cette commande administrative est réservée au propriétaire du bot.",
      ephemeral: true
    });
  }

  const previousChannelId = channelStore.getChannelId();

  if (!previousChannelId) {
    return interaction.reply({
      content: "ℹ️ **Aucun salon n'est actuellement configuré.** Il n'y a aucun salon à retirer.",
      ephemeral: true
    });
  }

  // 2. Suppression du salon configuré
  const success = channelStore.unsetChannelId(interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(success ? 0xed4245 : 0xfee75c) // Rouge Discord
    .setTitle("🗑️ Salon de Relais Retiré")
    .setDescription(
      `Le salon configuré précédemment (<#${previousChannelId}>) a été **retiré avec succès**.\n\n` +
      "**Conséquences :**\n" +
      "• Le bot ne relaiera plus aucun message depuis ce salon.\n" +
      "• Les messages privés envoyés au bot ne seront plus publiés dans ce salon.\n" +
      "• Vous pouvez définir un nouveau salon à tout moment avec la commande `/setchannel #nouveau-salon`."
    )
    .addFields(
      { name: "Ancien Salon ID", value: `\`${previousChannelId}\``, inline: true },
      { name: "Statut Actuel", value: "`Aucun salon actif`", inline: true }
    )
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}
