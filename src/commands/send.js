/**
 * Commande /send - Permet au propriétaire d'envoyer un message et/ou un fichier dans le salon configuré.
 * Réservée au propriétaire autorisé.
 */
import {
  SlashCommandBuilder,
  AttachmentBuilder,
  PermissionsBitField,
  MessageFlags,
  ChannelType
} from "discord.js";
import { channelStore } from "../services/channelStore.js";
import {
  isAnonymousChannel,
  buildAnonymousPayload,
  MAX_ATTACHMENT_SIZE_BYTES,
  isUserAdminOrOwner
} from "../services/messageRelay.js";
import { moderateAnonymousMessage } from "../services/aiModeration.js";
import { logger } from "../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("send")
  .setDescription("Publie un message dans un salon du serveur (réservé aux admins).")
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("Le contenu du message à publier")
      .setRequired(true)
      .setMaxLength(2000)
  )
  .addChannelOption((option) =>
    option
      .setName("salon")
      .setDescription("Le salon cible où publier (optionnel, sinon salon par défaut)")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(false)
  )
  .addAttachmentOption((option) =>
    option
      .setName("piece_jointe")
      .setDescription("Fichier ou image à joindre (optionnel, max 25 Mo)")
      .setRequired(false)
  );

export const ownerOnly = false;

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  // 1. Vérification des droits administrateur ou propriétaire (rôle admin, permissions ou propriétaire)
  const isAllowed = await isUserAdminOrOwner(interaction.user.id, interaction.client);

  if (!isAllowed) {
    logger.warn(`[Command:send] Tentative non autorisée par ${interaction.user.tag} (${interaction.user.id})`);
    return interaction.reply({
      content: "⛔ **Accès refusé** : Cette commande administrative est réservée au propriétaire et aux administrateurs (rôle Admin).",
      flags: MessageFlags.Ephemeral
    });
  }

  // 2. Détermination du salon cible (choisi par l'admin ou par défaut)
  const chosenChannel = interaction.options.getChannel("salon");
  const targetChannelId = chosenChannel?.id || channelStore.getChannelId();

  if (!targetChannelId) {
    return interaction.reply({
      content: "⚠️ **Aucun salon spécifié.** Choisissez un salon avec l'option `salon` ou configurez un salon par défaut avec `/setchannel`.",
      flags: MessageFlags.Ephemeral
    });
  }

  const messageText = interaction.options.getString("message");
  const attachment = interaction.options.getAttachment("piece_jointe");

  // 3. Validation de la pièce jointe si fournie
  if (attachment && attachment.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return interaction.reply({
      content: `❌ Le fichier est trop lourd (${(attachment.size / (1024 * 1024)).toFixed(1)} Mo). La limite Discord est de 25 Mo.`,
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // 4. Récupération du salon
  let targetChannel;
  try {
    targetChannel = await interaction.client.channels.fetch(targetChannelId);
  } catch (err) {
    logger.error(`[Command:send] Erreur de récupération du salon ${targetChannelId} :`, err.message);
    return interaction.editReply({
      content: `❌ Impossible d'accéder au salon configuré (\`${targetChannelId}\`). Vérifiez que le salon existe toujours.`
    });
  }

  if (!targetChannel || !targetChannel.isTextBased()) {
    return interaction.editReply({
      content: "❌ Le salon configuré n'est pas un salon textuel valide."
    });
  }

  // 5. Vérification des permissions
  if (targetChannel.guild) {
    const botMember = targetChannel.guild.members.me || await targetChannel.guild.members.fetchMe().catch(() => null);
    if (botMember) {
      const perms = targetChannel.permissionsFor(botMember);
      const required = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages];
      if (attachment) required.push(PermissionsBitField.Flags.AttachFiles);

      const missing = perms ? perms.missing(required) : [];
      if (missing.length > 0) {
        return interaction.editReply({
          content: `❌ Le bot n'a pas les permissions requises dans <#${targetChannel.id}> : ${missing.join(", ")}`
        });
      }
    }
  }

  // 6. Envoi du message
  try {
    let sendPayload;
    if (isAnonymousChannel(targetChannel)) {
      const moderation = await moderateAnonymousMessage(messageText);
      if (!moderation.allowed) {
        return interaction.editReply({
          content:
            "⚠️ **Message refusé par la modération IA (YouCode / BDE)**\n\n" +
            "Le message a été bloqué car il contient des propos inappropriés ou est hors contexte de l'école/BDE.\n\n" +
            `💬 **Motif de l'IA :** *${moderation.reason}*\n\n` +
            "🔒 *Le salon anonyme n'accepte pas les insultes ou les messages hors contexte.*"
        });
      }
      sendPayload = buildAnonymousPayload(messageText, attachment ? [attachment] : []);
    } else {
      sendPayload = {
        content: messageText
      };
      if (attachment) {
        sendPayload.files = [new AttachmentBuilder(attachment.url, { name: attachment.name })];
      }
    }

    const sentMessage = await targetChannel.send(sendPayload);
    logger.info(`[Command:send] Message envoyé avec succès dans #${targetChannel.name} (ID: ${sentMessage.id}) par l'administrateur`);

    await interaction.editReply({
      content: `✅ **Message publié avec succès dans <#${targetChannel.id}> !** ([Voir le message](${sentMessage.url}))`
    });
  } catch (err) {
    logger.error(`[Command:send] Échec d'envoi dans #${targetChannel.name} :`, err);
    await interaction.editReply({
      content: `❌ Erreur lors de l'envoi du message : \`${err.message}\``
    });
  }
}
