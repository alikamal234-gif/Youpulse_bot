/**
 * Service de relais bidirectionnel de messages entre MP (Propriétaire) et Salon Discord.
 */
import { EmbedBuilder, AttachmentBuilder, PermissionsBitField } from "discord.js";
import { config } from "../config.js";
import { channelStore } from "./channelStore.js";
import { logger } from "../utils/logger.js";

// Limite maximale de taille de fichier pour les uploads Discord standards (25 Mo)
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Valide si les pièces jointes respectent la limite de taille Discord.
 * @param {Array<{ size: number, name: string }>} attachments
 * @returns {{ valid: boolean, oversizedFiles: string[] }}
 */
export function validateAttachmentSizes(attachments = []) {
  const oversizedFiles = [];
  for (const att of attachments) {
    if (att.size > MAX_ATTACHMENT_SIZE_BYTES) {
      oversizedFiles.push(`${att.name || "fichier"} (${(att.size / (1024 * 1024)).toFixed(1)} Mo)`);
    }
  }
  return {
    valid: oversizedFiles.length === 0,
    oversizedFiles
  };
}

/**
 * Construit les données de l'embed pour la notification envoyée en MP au propriétaire.
 * @param {import('discord.js').Message} message
 * @returns {import('discord.js').EmbedBuilder}
 */
export function buildChannelToDmEmbed(message) {
  const authorName = message.member?.displayName || message.author.displayName || message.author.username;
  const channelName = message.channel.name || "salon-inconnu";
  const guildName = message.guild?.name || "Serveur Discord";
  const avatarUrl = message.author.displayAvatarURL({ dynamic: true });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2) // Bleu Discord Blurple
    .setAuthor({
      name: `${authorName} dans #${channelName}`,
      iconURL: avatarUrl,
      url: message.url
    })
    .setFooter({
      text: `${guildName} • Message ID: ${message.id}`
    })
    .setTimestamp(message.createdAt);

  if (message.content && message.content.trim().length > 0) {
    // Discord embed description supporte jusqu'à 4096 caractères
    const trimmedContent = message.content.length > 4000
      ? `${message.content.substring(0, 3997)}...`
      : message.content;
    embed.setDescription(trimmedContent);
  } else if (message.attachments.size > 0) {
    embed.setDescription("*(Message contenant uniquement des pièces jointes)*");
  } else {
    embed.setDescription("*(Message vide ou média externe)*");
  }

  const attachmentsList = message.attachments ? Array.from(message.attachments.values()) : [];

  // Prévisualisation de la première image si présente
  const firstImage = attachmentsList.find((att) =>
    att.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(att.name)
  );
  if (firstImage) {
    embed.setImage(firstImage.url);
  }

  // Liste des pièces jointes si multiples
  if (attachmentsList.length > 0) {
    const fileList = attachmentsList
      .map((att, idx) => `[${idx + 1}. ${att.name || "Fichier"}](${att.url}) (${(att.size / 1024).toFixed(1)} Ko)`)
      .join("\n");

    if (fileList.length <= 1024) {
      embed.addFields({ name: `📎 Pièces jointes (${attachmentsList.length})`, value: fileList });
    }
  }

  return embed;
}

/**
 * Relaye un message privé (DM) de l'administrateur vers le salon configuré.
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 */
export async function relayDmToChannel(message, client) {
  // 1. Vérification de l'autorisation : seul le propriétaire peut relayer
  if (message.author.id !== config.ownerId) {
    logger.warn(`[Relay:DM->Salon] Tentative d'envoi non autorisée par l'utilisateur ID: ${message.author.id}`);
    return;
  }

  // 2. Vérification de la configuration du salon
  const targetChannelId = channelStore.getChannelId();
  if (!targetChannelId) {
    await message.reply(
      "⚠️ **Aucun salon de destination n'est configuré.**\n" +
      "Veuillez définir un salon avec la commande `/setchannel #salon` sur votre serveur Discord."
    ).catch(() => {});
    return;
  }

  // 3. Validation du contenu (ne pas envoyer un message vide sans pièce jointe)
  const hasText = Boolean(message.content && message.content.trim().length > 0);
  const hasAttachments = message.attachments.size > 0;

  if (!hasText && !hasAttachments) {
    await message.reply("⚠️ Impossible de relayer un message vide.").catch(() => {});
    return;
  }

  // 4. Validation de la taille des pièces jointes
  const attachmentsArray = Array.from(message.attachments.values());
  const sizeValidation = validateAttachmentSizes(attachmentsArray);
  if (!sizeValidation.valid) {
    await message.reply(
      `❌ **Fichier trop volumineux pour l'API Discord (limite 25 Mo) :**\n` +
      sizeValidation.oversizedFiles.map((f) => `• ${f}`).join("\n")
    ).catch(() => {});
    return;
  }

  // 5. Récupération du salon cible et vérification des permissions
  let targetChannel;
  try {
    targetChannel = await client.channels.fetch(targetChannelId);
  } catch (err) {
    logger.error(`[Relay:DM->Salon] Erreur lors de la récupération du salon ${targetChannelId} :`, err.message);
    await message.reply(
      `❌ **Erreur d'accès au salon configuré (` + targetChannelId + `).**\n` +
      `Vérifiez que le salon existe et que le bot a bien été invité sur le serveur.`
    ).catch(() => {});
    return;
  }

  if (!targetChannel || !targetChannel.isTextBased()) {
    await message.reply("❌ Le salon configuré n'est pas un salon textuel valide.").catch(() => {});
    return;
  }

  // Vérification des permissions du bot dans le salon de destination
  if (targetChannel.guild) {
    const botMember = targetChannel.guild.members.me || await targetChannel.guild.members.fetchMe().catch(() => null);
    if (botMember) {
      const perms = targetChannel.permissionsFor(botMember);
      const requiredPerms = [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages
      ];
      if (hasAttachments) {
        requiredPerms.push(PermissionsBitField.Flags.AttachFiles);
      }

      const missing = perms ? perms.missing(requiredPerms) : [];
      if (missing.length > 0) {
        await message.reply(
          `❌ **Permissions manquantes dans le salon #${targetChannel.name} :**\n` +
          missing.map((p) => `• \`${p}\``).join("\n")
        ).catch(() => {});
        return;
      }
    }
  }

  // 6. Préparation du payload de transmission
  const files = attachmentsArray.map((att) =>
    new AttachmentBuilder(att.url, { name: att.name || "piece-jointe" })
  );

  const sendPayload = {};
  if (hasText) {
    sendPayload.content = message.content;
  }
  if (files.length > 0) {
    sendPayload.files = files;
  }

  // 7. Transmission du message vers le salon cible
  try {
    const sentMessage = await targetChannel.send(sendPayload);
    logger.info(`[Relay:DM->Salon] Message relayé avec succès dans #${targetChannel.name} (ID: ${sentMessage.id})`);

    // 8. Envoi de la confirmation au propriétaire en MP
    const confirmationText = files.length > 0
      ? `✅ Message et ${files.length} pièce(s) jointe(s) transmis dans **#${targetChannel.name}** ! ([Lien](${sentMessage.url}))`
      : `✅ Message transmis dans **#${targetChannel.name}** ! ([Lien](${sentMessage.url}))`;

    await message.reply(confirmationText).catch(() => {});
  } catch (err) {
    logger.error(`[Relay:DM->Salon] Échec de transmission vers le salon :`, err);
    await message.reply(
      `❌ **Échec de la transmission du message dans #${targetChannel.name}** :\n\`${err.message}\``
    ).catch(() => {});
  }
}

/**
 * Relaye un message publié dans le salon surveillé vers les MP du propriétaire.
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 */
export async function relayChannelToDm(message, client) {
  const configuredChannelId = channelStore.getChannelId();

  // 1. Vérification que le message provient bien du salon configuré
  if (!configuredChannelId || message.channel.id !== configuredChannelId) {
    return;
  }

  // 2. Ignorer les messages de ce bot pour éviter toute boucle
  if (message.author.id === client.user.id) {
    return;
  }

  // 3. Ignorer les autres bots par défaut pour éviter les boucles de notification
  if (message.author.bot) {
    logger.debug(`[Relay:Salon->DM] Message du bot ${message.author.tag} ignoré`);
    return;
  }

  // 4. Récupération du propriétaire
  let ownerUser;
  try {
    ownerUser = await client.users.fetch(config.ownerId);
  } catch (err) {
    logger.error(`[Relay:Salon->DM] Impossible de trouver l'utilisateur propriétaire (${config.ownerId}) :`, err.message);
    return;
  }

  if (!ownerUser) {
    logger.error(`[Relay:Salon->DM] Propriétaire introuvable pour l'identifiant ${config.ownerId}`);
    return;
  }

  // 5. Construction de la notification avec embed et pièces jointes
  const embed = buildChannelToDmEmbed(message);
  const attachmentsArray = Array.from(message.attachments.values());
  const files = attachmentsArray
    .filter((att) => att.size <= MAX_ATTACHMENT_SIZE_BYTES)
    .map((att) => new AttachmentBuilder(att.url, { name: att.name || "piece-jointe" }));

  const dmPayload = {
    embeds: [embed],
    files: files.length > 0 ? files : undefined
  };

  // 6. Envoi du MP avec gestion gracieuse des erreurs (fermeture des MP, blocage)
  try {
    await ownerUser.send(dmPayload);
    logger.info(`[Relay:Salon->DM] Notification envoyée au propriétaire pour le message de ${message.author.tag} dans #${message.channel.name}`);
  } catch (err) {
    // Code Discord 50007 : Cannot send messages to this user (DMs disabled or blocked)
    if (err.code === 50007) {
      logger.warn(
        `[Relay:Salon->DM] Impossible d'envoyer le MP au propriétaire (${ownerUser.tag}) : ` +
        `Les messages privés semblent fermés ou le bot est bloqué (Code API 50007).`
      );
    } else {
      logger.error(`[Relay:Salon->DM] Erreur lors de l'envoi du message privé au propriétaire :`, err.message);
    }
  }
}
