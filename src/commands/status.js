/**
 * Commande /status - Affiche le salon configuré, l'état de connexion et le statut système.
 * Réservée au propriétaire autorisé.
 */
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { config } from "../config.js";
import { channelStore } from "../services/channelStore.js";
import { logger } from "../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Affiche le salon configuré, l'état de connexion et le statut de configuration.");

export const ownerOnly = true;

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  // 1. Vérification propriétaire
  if (interaction.user.id !== config.ownerId) {
    logger.warn(`[Command:status] Tentative non autorisée par ${interaction.user.tag} (${interaction.user.id})`);
    return interaction.reply({
      content: "⛔ **Accès refusé** : Cette commande administrative est réservée au propriétaire du bot.",
      flags: MessageFlags.Ephemeral
    });
  }

  const client = interaction.client;
  const channelMeta = channelStore.getMetadata();
  let channelDisplay = "*Non configuré* (utilisez `/setchannel`)";

  if (channelMeta.channelId) {
    const fetchedChannel = client.channels.cache.get(channelMeta.channelId);
    channelDisplay = fetchedChannel
      ? `<#${channelMeta.channelId}> (\`${fetchedChannel.name}\`) sur **${fetchedChannel.guild.name}**`
      : `<#${channelMeta.channelId}> *(Salon hors cache ou inaccessible)*`;
  }

  const memoryUsageMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const totalGuilds = client.guilds.cache.size;
  const wsPing = client.ws.ping >= 0 ? `${client.ws.ping} ms` : "En connexion";

  const embed = new EmbedBuilder()
    .setColor(channelMeta.isConfigured ? 0x5865f2 : 0xfee75c)
    .setTitle("📊 Statut du Bot YouPulse")
    .addFields(
      {
        name: "📡 Connexion Discord",
        value:
          `• **Statut** : Connecté (${client.user.tag})\n` +
          `• **Latence WebSocket** : \`${wsPing}\`\n` +
          `• **Serveurs connectés** : \`${totalGuilds}\``,
        inline: false
      },
      {
        name: "🎯 Salon de Relais Actif",
        value:
          `• **Salon** : ${channelDisplay}\n` +
          `• **ID** : \`${channelMeta.channelId || "Aucun"}\`\n` +
          `• **Dernière MAJ** : ${channelMeta.updatedAt ? `<t:${Math.floor(new Date(channelMeta.updatedAt).getTime() / 1000)}:R>` : "*Défaut/Initial*"}\n` +
          `• **Modifié par** : \`${channelMeta.updatedBy || "Système"}\``,
        inline: false
      },
      {
        name: "⚙️ Environnement & Ressources",
        value:
          `• **Node.js** : \`${process.version}\`\n` +
          `• **Mémoire Heap** : \`${memoryUsageMb} Mo\`\n` +
          `• **Propriétaire ID** : \`${config.ownerId}\``,
        inline: false
      }
    )
    .setFooter({ text: "YouPulse Bot • Surveillance et Relais" })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral
  });
}
