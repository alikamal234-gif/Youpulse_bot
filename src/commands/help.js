/**
 * Commande /help - Affiche les commandes disponibles, leur syntaxe et les permissions.
 */
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { isUserAdminOrOwner } from "../services/messageRelay.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Affiche la liste des commandes disponibles et leur utilisation.");

export const ownerOnly = false;

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  const isAllowed = await isUserAdminOrOwner(interaction.user.id, interaction.client);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📖 Guide des Commandes YouPulse")
    .setDescription(
      "YouPulse est un bot Discord sécurisé avec relais bidirectionnel et système de messages anonymes.\n\n" +
      "**Fonctionnalités en Message Privé (MP) :**\n" +
      "• **Membres** : Envoyez un message ou `/annonime` en MP au bot pour poster anonymement dans `#anonyme`.\n" +
      "• **Admins** : Envoyez un message en MP pour choisir le salon du serveur via un menu déroulant ou tapez `#salon message`."
    )
    .addFields(
      {
        name: "🌐 Commandes Publiques (Tous les membres)",
        value:
          "• `/anonyme [message] [fichier]` — Envoie un message 100% anonyme dans le salon #anonyme.\n" +
          "• `/annonime [message] [fichier]` — Alias identique à /anonyme.\n" +
          "• `/ping` — Vérifie la latence de connexion du bot.\n" +
          "• `/uptime` — Affiche le temps d'activité du processus.\n" +
          "• `/help` — Affiche ce menu d'aide."
      },
      {
        name: "🔐 Commandes Administrateur",
        value:
          "• `/send [message] [salon] [fichier]` — Publie un message dans n'importe quel salon du serveur.\n" +
          "• `/setchannel [salon]` — Définit le salon de relais pour les Private Messages.\n" +
          "• `/unsetchannel` — Retire le salon configuré (désactive le relais).\n" +
          "• `/status` — Affiche l'état du salon, la connexion et les diagnostics.\n" +
          "• `/testdm` — Envoie un message test en MP pour vérifier la réception."
      }
    )
    .setFooter({
      text: isAllowed
        ? "👑 Vous êtes identifié comme Administrateur autorisé (rôle Admin / Propriétaire)."
        : "ℹ️ Vous êtes en mode utilisateur standard."
    })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    flags: isAllowed ? undefined : MessageFlags.Ephemeral
  });
}
