/**
 * Commande /testdm - Envoie un message direct de test au propriétaire pour vérifier la communication.
 * Réservée au propriétaire autorisé.
 */
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("testdm")
  .setDescription("Vérifie si le bot peut vous envoyer un message privé (MP).");

export const ownerOnly = true;

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  // 1. Vérification propriétaire
  if (interaction.user.id !== config.ownerId) {
    logger.warn(`[Command:testdm] Tentative non autorisée par ${interaction.user.tag} (${interaction.user.id})`);
    return interaction.reply({
      content: "⛔ **Accès refusé** : Cette commande administrative est réservée au propriétaire du bot.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const owner = await interaction.client.users.fetch(config.ownerId);
    if (!owner) {
      return interaction.editReply({
        content: `❌ Impossible de récupérer votre profil Discord avec l'ID \`${config.ownerId}\`.`
      });
    }

    const testEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("🔔 Test de Message Privé Réussi !")
      .setDescription(
        "Ce message confirme que le bot YouPulse a les permissions nécessaires pour communiquer avec vous en privé.\n\n" +
        "Lorsque des messages seront publiés dans votre salon surveillé, vous recevrez les alertes directement ici."
      )
      .addFields(
        { name: "Date du test", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: "Serveur", value: interaction.guild?.name || "Commande directe", inline: true }
      )
      .setFooter({ text: "YouPulse Bot • Test de connectivité DM" })
      .setTimestamp();

    await owner.send({ embeds: [testEmbed] });

    await interaction.editReply({
      content: "✅ **Test réussi !** Un message privé de vérification vient de vous être envoyé."
    });
  } catch (err) {
    logger.error(`[Command:testdm] Échec du test MP :`, err);

    if (err.code === 50007) {
      await interaction.editReply({
        content:
          "❌ **Impossible d'envoyer le message privé (Erreur 50007)**.\n\n" +
          "**Cause fréquente :** Vos messages privés sont fermés sur ce serveur ou vous n'avez pas de serveur en commun autorisant les MP.\n\n" +
          "**Comment corriger :**\n" +
          "1. Cliquez sur le nom du serveur en haut à gauche.\n" +
          "2. Sélectionnez **Paramètres de confidentialité**.\n" +
          "3. Activez l'option **Messages privés** provenant des membres du serveur.\n" +
          "4. Réessayez la commande `/testdm`."
      });
    } else {
      await interaction.editReply({
        content: `❌ **Erreur inattendue lors de l'envoi du MP** : \`${err.message}\``
      });
    }
  }
}
