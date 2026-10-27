/**
 * Commande /uptime - Affiche le temps d'activité du bot et l'horodatage de démarrage.
 */
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("uptime")
  .setDescription("Affiche depuis combien de temps le bot est en ligne.");

export const ownerOnly = false;

/**
 * Formate un nombre de secondes en chaîne lisible (jours, heures, minutes, secondes).
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatUptime(totalSeconds) {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / (60 * 60)) % 24);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  const uptimeSeconds = process.uptime();
  const readableUptime = formatUptime(uptimeSeconds);
  const startedAtTimestamp = Math.floor((Date.now() - uptimeSeconds * 1000) / 1000);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("⏱️ Temps d'activité (Uptime)")
    .addFields(
      { name: "⏳ Durée en ligne", value: `\`${readableUptime}\``, inline: true },
      { name: "🚀 Démarré le", value: `<t:${startedAtTimestamp}:F> (<t:${startedAtTimestamp}:R>)`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({
    embeds: [embed]
  });
}
