/**
 * Commande /help - Affiche les commandes disponibles, leur syntaxe et les permissions.
 */
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { config } from "../config.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Affiche la liste des commandes disponibles et leur utilisation.");

export const ownerOnly = false;

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  const isOwner = interaction.user.id === config.ownerId;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📖 Guide des Commandes YouPulse")
    .setDescription(
      "YouPulse est un bot Discord sécurisé avec relais bidirectionnel entre vos messages privés et un salon dédié.\n\n" +
      "**Fonctionnement du relais :**\n" +
      "• Tout message ou fichier envoyé au bot en **Message Privé (MP)** par le propriétaire est automatiquement retransmis vers le salon configuré.\n" +
      "• Tout nouveau message publié par les membres dans le salon configuré est notifié dans les **MP du propriétaire**."
    )
    .addFields(
      {
        name: "🌐 Commandes Publiques",
        value:
          "• `/ping` — Vérifie la latence de connexion du bot.\n" +
          "• `/uptime` — Affiche le temps d'activité du processus.\n" +
          "• `/help` — Affiche ce menu d'aide."
      },
      {
        name: "🔐 Commandes Administrateur (Propriétaire uniquement)",
        value:
          "• `/setchannel [salon]` — Définit le salon Discord de relais actif.\n" +
          "• `/status` — Affiche l'état du salon, la connexion et les diagnostics.\n" +
          "• `/send [message] [piece_jointe]` — Envoie un message dans le salon configuré.\n" +
          "• `/testdm` — Envoie un message test en MP au propriétaire pour vérifier la réception."
      }
    )
    .setFooter({
      text: isOwner
        ? "👑 Vous êtes identifié comme Propriétaire autorisé."
        : "ℹ️ Vous êtes en mode utilisateur standard."
    })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: !isOwner
  });
}
