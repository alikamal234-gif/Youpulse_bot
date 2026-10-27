/**
 * Commande /privatemessage - Envoie un message privé à tous les membres du serveur (broadcast DM).
 * Réservée au propriétaire autorisé.
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder
} from "discord.js";
import { config } from "../config.js";
import { channelStore } from "../services/channelStore.js";
import { MAX_ATTACHMENT_SIZE_BYTES } from "../services/messageRelay.js";
import { logger } from "../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("privatemessage")
  .setDescription("Envoie un message privé (DM) à tous les membres du serveur.")
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("Le contenu du message privé à diffuser")
      .setRequired(true)
      .setMaxLength(2000)
  )
  .addAttachmentOption((option) =>
    option
      .setName("piece_jointe")
      .setDescription("Image ou fichier à joindre (optionnel, max 25 Mo)")
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName("publier_salon")
      .setDescription("Publier également le message dans le salon configuré (par défaut: Oui)")
      .setRequired(false)
  );

export const ownerOnly = true;

/**
 * Pause asynchrone pour respecter les limites de débit de Discord (Rate limits DM).
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  // 1. Vérification de sécurité propriétaire
  if (interaction.user.id !== config.ownerId) {
    logger.warn(`[Command:privatemessage] Tentative non autorisée par ${interaction.user.tag} (${interaction.user.id})`);
    return interaction.reply({
      content: "⛔ **Accès refusé** : Cette commande administrative est réservée au propriétaire du bot.",
      ephemeral: true
    });
  }

  if (!interaction.guild) {
    return interaction.reply({
      content: "❌ Cette commande doit être exécutée depuis un serveur Discord.",
      ephemeral: true
    });
  }

  const messageText = interaction.options.getString("message");
  const attachment = interaction.options.getAttachment("piece_jointe");
  const publishInChannel = interaction.options.getBoolean("publier_salon") ?? true;

  // 2. Validation de la taille de la pièce jointe
  if (attachment && attachment.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return interaction.reply({
      content: `❌ Le fichier est trop volumineux (${(attachment.size / (1024 * 1024)).toFixed(1)} Mo). La limite est de 25 Mo.`,
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  // 3. Récupération de tous les membres du serveur (hors robots)
  let membersCollection;
  try {
    membersCollection = await interaction.guild.members.fetch();
  } catch (err) {
    logger.warn(`[Command:privatemessage] Impossible de fetch tous les membres (${err.message}), repli sur le cache local.`);
    membersCollection = interaction.guild.members.cache;
  }

  // Filtrer pour ne garder que les vrais utilisateurs (exclure les bots)
  const targets = Array.from(membersCollection.values()).filter((member) => !member.user.bot);

  if (targets.length === 0) {
    return interaction.editReply({
      content: "⚠️ Aucun membre humain trouvé sur ce serveur pour recevoir le message privé."
    });
  }

  // 4. Construction de l'Embed "Private Message" (sans texte de test)
  const embed = new EmbedBuilder()
    .setColor(0x5865f2) // Bleu Discord
    .setTitle("📩 Private Message")
    .setDescription(messageText)
    .setAuthor({
      name: `${interaction.user.displayName || interaction.user.username} (${interaction.guild.name})`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setFooter({
      text: `${interaction.guild.name} • Message Privé Officiel`
    })
    .setTimestamp();

  if (attachment) {
    if (attachment.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(attachment.name)) {
      embed.setImage(attachment.url);
    } else {
      embed.addFields({
        name: "📎 Pièce jointe",
        value: `[${attachment.name}](${attachment.url}) (${(attachment.size / 1024).toFixed(1)} Ko)`
      });
    }
  }

  const files = [];
  if (attachment) {
    files.push(new AttachmentBuilder(attachment.url, { name: attachment.name }));
  }

  const dmPayload = {
    embeds: [embed],
    files: files.length > 0 ? files : undefined
  };

  // 5. Envoi direct aux membres du serveur avec temporisation anti-rate-limit
  let successCount = 0;
  let failedCount = 0;

  for (const member of targets) {
    try {
      await member.send(dmPayload);
      successCount++;
    } catch (err) {
      failedCount++;
      if (err.code === 50007) {
        logger.debug(`[Command:privatemessage] MP fermé pour ${member.user.tag}`);
      } else {
        logger.warn(`[Command:privatemessage] Échec d'envoi à ${member.user.tag} : ${err.message}`);
      }
    }
    // Délai de 150ms entre chaque envoi pour respecter les quotas de l'API Discord
    await sleep(150);
  }

  // 6. Publication facultative dans le salon configuré
  let channelNotice = "";
  if (publishInChannel) {
    const configuredChannelId = channelStore.getChannelId();
    if (configuredChannelId) {
      try {
        const targetChannel = await interaction.client.channels.fetch(configuredChannelId);
        if (targetChannel && targetChannel.isTextBased()) {
          const channelPayload = { content: messageText };
          if (files.length > 0) {
            channelPayload.files = files;
          }
          await targetChannel.send(channelPayload);
          channelNotice = `\n📢 **Publié également dans <#${configuredChannelId}>**`;
        }
      } catch (err) {
        logger.warn(`[Command:privatemessage] Impossible de publier dans le salon : ${err.message}`);
      }
    }
  }

  logger.info(`[Command:privatemessage] Diffusion terminée : ${successCount} réussis, ${failedCount} échoués sur ${targets.length} membres.`);

  await interaction.editReply({
    content:
      `✅ **Diffusion "Private Message" terminée !**\n\n` +
      `• **Reçus avec succès** : \`${successCount} membre(s)\`\n` +
      `• **Non remis (MP fermés/bloqués)** : \`${failedCount} membre(s)\`\n` +
      `• **Total membres ciblés** : \`${targets.length}\`${channelNotice}`
  });
}
