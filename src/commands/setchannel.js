/**
 * Commande /setchannel - Configure le salon utilisé pour la publication et les notifications.
 * Réservée au propriétaire autorisé.
 */
import { SlashCommandBuilder, ChannelType, PermissionsBitField, EmbedBuilder, MessageFlags } from "discord.js";
import { channelStore } from "../services/channelStore.js";
import { isUserAdminOrOwner } from "../services/messageRelay.js";
import { logger } from "../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("setchannel")
  .setDescription("Configure le salon utilisé pour la publication et les notifications de relais.")
  .addChannelOption((option) =>
    option
      .setName("salon")
      .setDescription("Le salon textuel de destination")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true)
  );

export const ownerOnly = true;

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  // 1. Vérification de l'autorisation propriétaire / admin (rôle Admin ou permissions)
  const isAllowed = await isUserAdminOrOwner(interaction.user.id, interaction.client);
  if (!isAllowed) {
    logger.warn(`[Command:setchannel] Tentative non autorisée par ${interaction.user.tag} (${interaction.user.id})`);
    return interaction.reply({
      content: "⛔ **Accès refusé** : Cette commande administrative est réservée au propriétaire et aux administrateurs (rôle Admin).",
      flags: MessageFlags.Ephemeral
    });
  }

  const selectedChannel = interaction.options.getChannel("salon");

  if (!selectedChannel || !selectedChannel.isTextBased()) {
    return interaction.reply({
      content: "❌ Veuillez sélectionner un salon textuel valide.",
      flags: MessageFlags.Ephemeral
    });
  }

  // 2. Vérification des permissions du bot dans le salon choisi
  const botMember = selectedChannel.guild.members.me || await selectedChannel.guild.members.fetchMe().catch(() => null);
  if (botMember) {
    const perms = selectedChannel.permissionsFor(botMember);
    const requiredPerms = [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.AttachFiles
    ];

    const missing = perms ? perms.missing(requiredPerms) : [];
    if (missing.length > 0) {
      return interaction.reply({
        content:
          `⚠️ **Permissions insuffisantes dans <#${selectedChannel.id}> !**\n` +
          `Le bot nécessite les permissions suivantes pour fonctionner correctement :\n` +
          missing.map((p) => `• \`${p}\``).join("\n"),
        flags: MessageFlags.Ephemeral
      });
    }
  }

  // 3. Sauvegarde dans le channelStore
  const success = channelStore.setChannelId(selectedChannel.id, interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(success ? 0x57f287 : 0xfee75c)
    .setTitle("✅ Salon de Relais Configuré")
    .setDescription(
      `Le salon actif a été configuré sur **<#${selectedChannel.id}>** (\`${selectedChannel.name}\`).\n\n` +
      "**Effets immédiats :**\n" +
      "• Les messages privés que vous envoyez au bot seront relayés dans ce salon.\n" +
      "• Les nouveaux messages postés dans ce salon vous seront envoyés en MP."
    )
    .addFields(
      { name: "ID du Salon", value: `\`${selectedChannel.id}\``, inline: true },
      { name: "Persistance", value: success ? "`Sauvegardé sur disque`" : "`En mémoire uniquement`", inline: true }
    )
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral
  });
}
