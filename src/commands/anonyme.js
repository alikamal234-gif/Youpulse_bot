/**
 * Commande /anonyme - Permet à n'importe quel membre du serveur d'envoyer un message 100% anonyme
 * dans le salon dédié (#anonyme / #annonime) sans que son identité soit révélée.
 */
import {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags
} from "discord.js";
import { MAX_ATTACHMENT_SIZE_BYTES, buildAnonymousPayload } from "../services/messageRelay.js";
import { moderateAnonymousMessage } from "../services/aiModeration.js";
import { logger } from "../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("anonyme")
  .setDescription("Envoie un message 100% anonyme dans le salon #anonyme.")
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("Le contenu de votre message anonyme")
      .setRequired(true)
      .setMaxLength(2000)
  )
  .addAttachmentOption((option) =>
    option
      .setName("piece_jointe")
      .setDescription("Image ou fichier à joindre anonymement (optionnel, max 25 Mo)")
      .setRequired(false)
  );

// Accessible à TOUS les membres du serveur
export const ownerOnly = false;

/**
 * Trouve le salon anonyme du serveur (nommé anonyme, annonime, anonymous ou confessions).
 * @param {import('discord.js').Guild} guild
 * @returns {import('discord.js').TextChannel|null}
 */
export function findAnonymousChannel(guild) {
  if (!guild || !guild.channels || !guild.channels.cache) return null;
  const channelList = Array.from(guild.channels.cache.values());
  return channelList.find((ch) => {
    if (!ch.isTextBased()) return false;
    const name = ch.name.toLowerCase();
    return name.includes("anonym") || name.includes("annonim") || name.includes("confession");
  }) || null;
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: "❌ Cette commande doit être utilisée sur un serveur Discord.",
      flags: MessageFlags.Ephemeral
    });
  }

  const messageText = interaction.options.getString("message");
  const attachment = interaction.options.getAttachment("piece_jointe");

  // 1. Validation de la taille de la pièce jointe
  if (attachment && attachment.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return interaction.reply({
      content: `❌ Le fichier est trop volumineux (${(attachment.size / (1024 * 1024)).toFixed(1)} Mo). Limite : 25 Mo.`,
      flags: MessageFlags.Ephemeral
    });
  }

  // 2. Recherche automatique du salon anonyme sur le serveur
  const targetChannel = findAnonymousChannel(interaction.guild);

  if (!targetChannel) {
    return interaction.reply({
      content:
        "❌ **Aucun salon nommé `#anonyme` n'a été trouvé sur ce serveur.**\n\n" +
        "👉 Demandez à un administrateur de créer un salon textuel nommé **`anonyme`** (ou `annonime`) pour activer cette fonctionnalité.",
      flags: MessageFlags.Ephemeral
    });
  }

  // 3. Vérification des permissions du bot dans le salon anonyme
  const botMember = targetChannel.guild.members.me || await targetChannel.guild.members.fetchMe().catch(() => null);
  if (botMember) {
    const perms = targetChannel.permissionsFor(botMember);
    const required = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks];
    if (attachment) required.push(PermissionsBitField.Flags.AttachFiles);

    const missing = perms ? perms.missing(required) : [];
    if (missing.length > 0) {
      return interaction.reply({
        content: `❌ Le bot n'a pas les permissions requises dans <#${targetChannel.id}> : ${missing.join(", ")}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // 4. Modération IA contextuelle (Groq) : validation BDE & École YouCode
  const moderation = await moderateAnonymousMessage(messageText);
  if (!moderation.allowed) {
    return interaction.editReply({
      content:
        "⚠️ **Message refusé par la modération IA (YouCode / BDE)**\n\n" +
        "Votre message a été filtré car il ne semble pas correspondre au contexte de l'école YouCode ou du BDE (études, hackathons, entraide, vie étudiante, questions de cours, feedback...).\n\n" +
        `💬 **Motif de l'IA :** *${moderation.reason}*\n\n` +
        "🔒 *Le salon anonyme est réservé aux discussions utiles et constructives pour la communauté étudiante.*"
    });
  }

  // 5. Construction et envoi du message avec le cadre anonyme standardisé
  try {
    const payload = buildAnonymousPayload(messageText, attachment ? [attachment] : []);
    const sentMessage = await targetChannel.send(payload);
    logger.info(`[Command:anonyme] Message anonyme publié avec succès dans #${targetChannel.name} (ID: ${sentMessage.id})`);

    // 6. Confirmation éphémère à l'auteur (visible uniquement par lui)
    await interaction.editReply({
      content: `✅ **Votre message a été posté anonymement avec succès dans <#${targetChannel.id}> !**\n🔒 Votre identité reste strictement confidentielle.`
    });
  } catch (err) {
    logger.error(`[Command:anonyme] Échec d'envoi dans #${targetChannel.name} :`, err);
    await interaction.editReply({
      content: `❌ Une erreur est survenue lors de l'envoi de votre message : \`${err.message}\``
    });
  }
}
