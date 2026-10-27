/**
 * Commande /ping - Vérifie la réactivité du bot et la latence WebSocket / API.
 */
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Vérifie la réactivité et la latence du bot.");

export const ownerOnly = false;

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  const sent = await interaction.reply({
    content: "Calcul de la latence en cours...",
    fetchReply: true
  });

  const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
  const wsPing = interaction.client.ws.ping;

  const embed = new EmbedBuilder()
    .setColor(0x57f287) // Vert Discord
    .setTitle("🏓 Pong !")
    .addFields(
      { name: "⚡ Latence Aller-Retour", value: `\`${roundtrip} ms\``, inline: true },
      { name: "💓 Latence WebSocket", value: `\`${wsPing >= 0 ? wsPing : 0} ms\``, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({
    content: null,
    embeds: [embed]
  });
}
