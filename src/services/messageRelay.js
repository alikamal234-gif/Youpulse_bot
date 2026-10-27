/**
 * Service de relais bidirectionnel de messages entre MP (Propriétaire) et Salon Discord.
 */
import {
  EmbedBuilder,
  AttachmentBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType
} from "discord.js";
import { config } from "../config.js";
import { channelStore } from "./channelStore.js";
import { moderateAnonymousMessage } from "./aiModeration.js";
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
 * Vérifie si un salon est un salon anonyme (ex: anonyme, annonime, confessions).
 * @param {import('discord.js').GuildBasedChannel|null} channel
 * @returns {boolean}
 */
export function isAnonymousChannel(channel) {
  if (!channel || !channel.name) return false;
  const name = channel.name.toLowerCase();
  return name.includes("anonym") || name.includes("annonim") || name.includes("confession");
}

/**
 * Construit le payload standardisé pour un message anonyme (Embed cadre identique pour tous).
 * @param {string} content
 * @param {Array<{ url: string, name?: string, size?: number, contentType?: string }>} attachments
 * @returns {{ embeds: import('discord.js').EmbedBuilder[], files?: import('discord.js').AttachmentBuilder[] }}
 */
export function buildAnonymousPayload(content, attachments = []) {
  let cleanContent = (content || "").trim();
  cleanContent = cleanContent.replace(/^[/!](?:anonyme|annonime|anonymous|confession)\s*/i, "");

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("🎭 Message Anonyme")
    .setDescription(cleanContent || "*(Pièce jointe anonyme)*")
    .setFooter({
      text: "Message 100% Anonyme • Identité masquée 🔒"
    })
    .setTimestamp();

  const files = [];
  const attachmentsList = Array.isArray(attachments)
    ? attachments
    : Array.from(attachments.values ? attachments.values() : []);

  const firstImage = attachmentsList.find((att) =>
    att.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(att.name || "")
  );

  if (firstImage) {
    embed.setImage(firstImage.url);
  }

  for (const att of attachmentsList) {
    if (att !== firstImage) {
      const sizeStr = att.size ? ` (${(att.size / 1024).toFixed(1)} Ko)` : "";
      embed.addFields({
        name: "📎 Fichier joint",
        value: `[${att.name || "fichier"}](${att.url})${sizeStr}`
      });
    }
    files.push(new AttachmentBuilder(att.url, { name: att.name || "fichier-anonyme" }));
  }

  const payload = { embeds: [embed] };
  if (files.length > 0) {
    payload.files = files;
  }
  return payload;
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
    .setTitle("📩 Private Message")
    .setAuthor({
      name: `${authorName} dans #${channelName}`,
      iconURL: avatarUrl,
      url: message.url
    })
    .setFooter({
      text: `${guildName} • Private Message`
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

// Cache des messages en attente de sélection de salon par un administrateur en MP
export const pendingAdminMessages = new Map();

/**
 * Analyse le message d'un administrateur en MP pour détecter un salon cible (#salon ou <#id>).
 * @param {string} text
 * @param {import('discord.js').Client} client
 * @returns {{ channel: import('discord.js').TextChannel, text: string }|null}
 */
export function parseChannelAndMessage(text, client) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  const match = trimmed.match(/^(?:\/send\s+)?(?:<#(\d+)>|#([a-zA-Z0-9_\-\u0600-\u06FF]+))\s*([\s\S]*)$/i);
  if (!match) return null;

  const channelId = match[1];
  const channelName = match[2];
  const remainingText = match[3] ? match[3].trim() : "";

  if (!client || !client.guilds || !client.guilds.cache) return null;

  for (const guild of client.guilds.cache.values()) {
    if (!guild.channels || !guild.channels.cache) continue;
    if (channelId) {
      const ch = guild.channels.cache.get(channelId);
      if (ch && ch.isTextBased()) return { channel: ch, text: remainingText };
    }
    if (channelName) {
      const ch = Array.from(guild.channels.cache.values()).find(
        (c) => c.isTextBased() && c.name.toLowerCase() === channelName.toLowerCase()
      );
      if (ch) return { channel: ch, text: remainingText };
    }
  }

  return null;
}

/**
 * Vérifie si un utilisateur est propriétaire du bot ou administrateur d'un serveur commun.
 * @param {string} userId
 * @param {import('discord.js').Client} client
 * @returns {Promise<boolean>}
 */
export async function isUserAdminOrOwner(userId, client) {
  if (userId === config.ownerId) return true;
  if (!client || !client.guilds || !client.guilds.cache) return false;

  for (const guild of client.guilds.cache.values()) {
    try {
      if (guild.ownerId === userId) return true;
      let member = guild.members.cache.get(userId);
      if (!member) {
        member = await guild.members.fetch(userId).catch(() => null);
      }
      if (member && member.permissions && member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return true;
      }
    } catch {
      // Poursuivre la vérification sur les autres serveurs
    }
  }
  return false;
}

/**
 * Relaye un message privé (DM) :
 * - Membre standard : Envoi anonyme dans #anonyme (identité masquée).
 * - Administrateur : Choix du salon (#salon direct ou menu déroulant de sélection).
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 */
export async function relayDmToChannel(message, client) {
  // 1. Détection du rôle de l'expéditeur (Admin / Propriétaire vs Membre standard)
  const isAdminOrOwner = await isUserAdminOrOwner(message.author.id, client);

  if (!isAdminOrOwner) {
    await relayAnonymousDm(message, client);
    return;
  }

  // 2. Traitement pour Administrateur / Propriétaire
  const hasText = Boolean(message.content && message.content.trim().length > 0);
  const hasAttachments = message.attachments.size > 0;

  if (!hasText && !hasAttachments) {
    await message.reply("⚠️ Impossible de relayer un message vide.").catch(() => {});
    return;
  }

  const attachmentsArray = Array.from(message.attachments.values());
  const sizeValidation = validateAttachmentSizes(attachmentsArray);
  if (!sizeValidation.valid) {
    await message.reply(
      `❌ **Fichier trop volumineux (limite 25 Mo) :**\n` +
      sizeValidation.oversizedFiles.map((f) => `• ${f}`).join("\n")
    ).catch(() => {});
    return;
  }

  // Cas A : L'administrateur a précisé le salon directement (#salon message ou /send #salon message)
  const parsed = parseChannelAndMessage(message.content, client);
  if (parsed) {
    const targetChannel = parsed.channel;
    const finalContent = parsed.text || (hasAttachments ? "" : message.content);

    let payload;
    if (isAnonymousChannel(targetChannel)) {
      payload = buildAnonymousPayload(finalContent, attachmentsArray);
    } else {
      const files = attachmentsArray.map((att) =>
        new AttachmentBuilder(att.url, { name: att.name || "piece-jointe" })
      );
      payload = {};
      if (finalContent) payload.content = finalContent;
      if (files.length > 0) payload.files = files;
    }

    try {
      const sentMessage = await targetChannel.send(payload);
      logger.info(`[AdminDM:Direct] Message envoyé dans #${targetChannel.name} (ID: ${sentMessage.id}) par l'administrateur`);
      await message.reply(
        `✅ **Message publié avec succès dans #${targetChannel.name} !** ([Voir le message](${sentMessage.url}))`
      ).catch(() => {});
      return;
    } catch (err) {
      logger.error(`[AdminDM:Direct] Échec d'envoi dans #${targetChannel.name} :`, err);
      await message.reply(`❌ Erreur lors de l'envoi dans #${targetChannel.name} : \`${err.message}\``).catch(() => {});
      return;
    }
  }

  // Cas B : Aucun salon spécifié -> Affichage du menu déroulant interactif
  const availableChannels = [];
  if (client.guilds && client.guilds.cache) {
    for (const guild of client.guilds.cache.values()) {
      const member = guild.members.cache.get(message.author.id);
      const isGuildAdmin = message.author.id === config.ownerId || guild.ownerId === message.author.id || member?.permissions?.has(PermissionsBitField.Flags.Administrator);
      if (isGuildAdmin && guild.channels && guild.channels.cache) {
        for (const ch of guild.channels.cache.values()) {
          if (ch.isTextBased() && !ch.isThread() && ch.type !== ChannelType.DM) {
            availableChannels.push(ch);
          }
        }
      }
    }
  }

  if (availableChannels.length === 0) {
    const defaultChannelId = channelStore.getChannelId();
    if (!defaultChannelId) {
      await message.reply(
        "⚠️ **Aucun salon textuel accessible.**\n" +
        "Précisez le salon avec `#nom-du-salon mon message` ou configurez un salon par défaut avec `/setchannel` sur le serveur."
      ).catch(() => {});
      return;
    }
  }

  // Stocker le message en mémoire pour la sélection via le menu
  pendingAdminMessages.set(message.id, {
    content: message.content,
    attachments: attachmentsArray,
    authorId: message.author.id,
    createdAt: Date.now()
  });

  setTimeout(() => pendingAdminMessages.delete(message.id), 10 * 60 * 1000);

  const defaultChannelId = channelStore.getChannelId();
  const selectOptions = availableChannels.slice(0, 25).map((ch) => {
    const isDefault = ch.id === defaultChannelId;
    return new StringSelectMenuOptionBuilder()
      .setLabel(`#${ch.name}${isDefault ? " ⭐ (Défaut)" : ""}`)
      .setDescription(`Publier dans #${ch.name} (${ch.guild?.name || "Serveur"})`)
      .setValue(ch.id);
  });

  if (selectOptions.length === 0 && defaultChannelId) {
    selectOptions.push(
      new StringSelectMenuOptionBuilder()
        .setLabel("Salon configuré par défaut")
        .setDescription(`ID: ${defaultChannelId}`)
        .setValue(defaultChannelId)
    );
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_channel_${message.id}`)
    .setPlaceholder("👇 Choisissez le salon où publier ce message...")
    .addOptions(selectOptions);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  const preview = message.content
    ? (message.content.length > 200 ? `${message.content.slice(0, 197)}...` : message.content)
    : "*(Fichier ou image)*";

  await message.reply({
    content:
      `📢 **Publication Administrative**\n\n` +
      `**Message prêt à être envoyé :**\n> ${preview}\n\n` +
      `💡 *Astuce : Vous pouvez aussi taper directement \`#salon mon message\`.*\n` +
      `👇 **Choisissez le salon de destination ci-dessous :**`,
    components: [row]
  }).catch(() => {});
}

/**
 * Traite la sélection du salon dans le menu déroulant par l'administrateur en MP.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
export async function handleSelectChannelInteraction(interaction) {
  if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith("select_channel_")) {
    return;
  }

  const messageId = interaction.customId.replace("select_channel_", "");
  const pending = pendingAdminMessages.get(messageId);
  const targetChannelId = interaction.values[0];

  if (!pending) {
    return interaction.update({
      content: "⚠️ **Ce message a expiré ou a déjà été envoyé.** Renvoyez votre message en MP pour le publier.",
      components: []
    }).catch(() => {});
  }

  let targetChannel;
  try {
    targetChannel = await interaction.client.channels.fetch(targetChannelId);
  } catch (err) {
    logger.error(`[AdminDM:SelectMenu] Erreur d'accès au salon ${targetChannelId} :`, err.message);
    return interaction.update({
      content: `❌ Impossible d'accéder au salon sélectionné (\`${targetChannelId}\`).`,
      components: []
    }).catch(() => {});
  }

  if (!targetChannel || !targetChannel.isTextBased()) {
    return interaction.update({
      content: "❌ Le salon choisi n'est pas un salon textuel valide.",
      components: []
    }).catch(() => {});
  }

  // Vérification des permissions
  if (targetChannel.guild) {
    const botMember = targetChannel.guild.members.me || await targetChannel.guild.members.fetchMe().catch(() => null);
    if (botMember) {
      const perms = targetChannel.permissionsFor(botMember);
      const required = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages];
      if (pending.attachments.length > 0) required.push(PermissionsBitField.Flags.AttachFiles);
      const missing = perms ? perms.missing(required) : [];
      if (missing.length > 0) {
        return interaction.update({
          content: `❌ Le bot n'a pas les permissions requises dans <#${targetChannel.id}> : ${missing.join(", ")}`,
          components: []
        }).catch(() => {});
      }
    }
  }

  let payload;
  if (isAnonymousChannel(targetChannel)) {
    payload = buildAnonymousPayload(pending.content, pending.attachments);
  } else {
    const files = pending.attachments.map((att) =>
      new AttachmentBuilder(att.url, { name: att.name || "piece-jointe" })
    );
    payload = {};
    if (pending.content && pending.content.trim().length > 0) {
      payload.content = pending.content;
    }
    if (files.length > 0) {
      payload.files = files;
    }
  }

  try {
    const sentMessage = await targetChannel.send(payload);
    pendingAdminMessages.delete(messageId);
    logger.info(`[AdminDM:SelectMenu] Message publié avec succès dans #${targetChannel.name} (ID: ${sentMessage.id}) par l'administrateur`);

    await interaction.update({
      content: `✅ **Message publié avec succès dans <#${targetChannel.id}> !** ([Voir le message](${sentMessage.url}))`,
      components: []
    }).catch(() => {});
  } catch (err) {
    logger.error(`[AdminDM:SelectMenu] Échec d'envoi dans #${targetChannel.name} :`, err);
    await interaction.update({
      content: `❌ Une erreur est survenue lors de l'envoi : \`${err.message}\``,
      components: []
    }).catch(() => {});
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Relaye un message publié dans le salon surveillé vers les MP de tous les membres du serveur ("Private Message").
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

  logger.info(`[Relay:Salon->DM] Message détecté dans #${message.channel.name} de ${message.author.tag} : "${message.content}"`);

  // 4. Construction de la notification avec embed et pièces jointes
  const embed = buildChannelToDmEmbed(message);
  const attachmentsArray = Array.from(message.attachments.values());
  const files = attachmentsArray
    .filter((att) => att.size <= MAX_ATTACHMENT_SIZE_BYTES)
    .map((att) => new AttachmentBuilder(att.url, { name: att.name || "piece-jointe" }));

  const dmPayload = {
    embeds: [embed],
    files: files.length > 0 ? files : undefined
  };

  // 5. Récupération des membres du serveur destinataires (tous les membres / ldrary kamlin)
  const targetUsersMap = new Map();

  // A. Toujours inclure le propriétaire de façon garantie
  try {
    const ownerUser = await client.users.fetch(config.ownerId);
    if (ownerUser) {
      targetUsersMap.set(ownerUser.id, ownerUser);
    }
  } catch (err) {
    logger.warn(`[Relay:Salon->DM] Impossible de récupérer le propriétaire (${config.ownerId}) : ${err.message}`);
  }

  // B. Récupérer les membres du serveur
  if (message.guild) {
    try {
      // Timeout de 2 secondes max pour éviter de bloquer si l'intent GuildMembers n'est pas activé
      const membersCollection = await message.guild.members.fetch({ time: 2000 });
      for (const m of membersCollection.values()) {
        if (!m.user.bot) {
          targetUsersMap.set(m.user.id, m.user);
        }
      }
    } catch {
      // Repli sur les membres du cache local
      for (const m of message.guild.members.cache.values()) {
        if (!m.user.bot) {
          targetUsersMap.set(m.user.id, m.user);
        }
      }
    }
  }

  const targetUsers = Array.from(targetUsersMap.values());
  logger.info(`[Relay:Salon->DM] Début de la transmission en MP à ${targetUsers.length} destinataire(s)...`);

  // 6. Diffusion en MP à tous les membres avec espacement anti rate-limit
  let successCount = 0;
  let failedCount = 0;

  for (const user of targetUsers) {
    try {
      await user.send(dmPayload);
      successCount++;
      logger.info(`[Relay:Salon->DM] ✅ MP transmis avec succès à ${user.tag}`);
    } catch (err) {
      failedCount++;
      if (err.code === 50007) {
        logger.warn(`[Relay:Salon->DM] ⚠️ MP fermé pour ${user.tag} (Vérifier les paramètres de confidentialité)`);
      } else {
        logger.error(`[Relay:Salon->DM] ❌ Erreur d'envoi MP à ${user.tag} : ${err.message}`);
      }
    }
    // Délai de précaution entre les messages
    if (targetUsers.length > 1) {
      await sleep(120);
    }
  }

  logger.info(
    `[Relay:Salon->DM] "Private Message" terminé : ${successCount}/${targetUsers.length} reçu(s) ` +
    `(Échecs/MP fermés : ${failedCount}) pour le message de ${message.author.tag} dans #${message.channel.name}`
  );
}

/**
 * Relaye un message privé envoyé par un membre ordinaire vers le salon #anonyme de façon 100% anonyme.
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 */
export async function relayAnonymousDm(message, client) {
  // Recherche d'un serveur commun avec le bot ayant un salon anonyme
  let targetChannel = null;

  for (const guild of client.guilds.cache.values()) {
    const ch = Array.from(guild.channels.cache.values()).find((c) => {
      if (!c.isTextBased()) return false;
      const name = c.name.toLowerCase();
      return name.includes("anonym") || name.includes("annonim") || name.includes("confession");
    });
    if (ch) {
      targetChannel = ch;
      break;
    }
  }

  if (!targetChannel) {
    await message.reply(
      "ℹ️ **Service Anonyme YouPulse**\n" +
      "Aucun salon nommé **#anonyme** n'a été trouvé sur les serveurs auxquels ce bot est connecté.\n" +
      "👉 Demandez à un administrateur de créer un salon textuel nommé **`anonyme`** (ou `annonime`) pour recevoir vos messages anonymes."
    ).catch(() => {});
    return;
  }

  let cleanText = message.content ? message.content.trim() : "";
  cleanText = cleanText.replace(/^[/!](?:anonyme|annonime|anonymous|confession)\s*/i, "");

  const hasText = Boolean(cleanText.length > 0);
  const hasAttachments = message.attachments.size > 0;

  if (!hasText && !hasAttachments) {
    await message.reply("⚠️ Impossible d'envoyer un message anonyme vide.").catch(() => {});
    return;
  }

  const attachmentsArray = Array.from(message.attachments.values());
  const sizeValidation = validateAttachmentSizes(attachmentsArray);
  if (!sizeValidation.valid) {
    await message.reply(
      `❌ **Fichier trop volumineux (limite 25 Mo) :**\n` +
      sizeValidation.oversizedFiles.map((f) => `• ${f}`).join("\n")
    ).catch(() => {});
    return;
  }

  // Modération IA contextuelle (Groq) : validation BDE & École YouCode
  if (hasText) {
    const moderation = await moderateAnonymousMessage(cleanText);
    if (!moderation.allowed) {
      await message.reply(
        "⚠️ **Message refusé par la modération IA (YouCode / BDE)**\n\n" +
        "Votre message a été filtré car il ne semble pas correspondre au contexte de l'école YouCode ou du BDE (études, hackathons, entraide, vie étudiante, questions de cours, feedback...).\n\n" +
        `💬 **Motif de l'IA :** *${moderation.reason}*\n\n` +
        "🔒 *Le salon anonyme est réservé aux discussions utiles et constructives pour la communauté étudiante.*"
      ).catch(() => {});
      return;
    }
  }

  const payload = buildAnonymousPayload(cleanText, attachmentsArray);

  try {
    const sent = await targetChannel.send(payload);
    logger.info(`[Relay:AnonymousDM] Message anonyme transmis avec succès dans #${targetChannel.name} (ID: ${sent.id})`);

    await message.reply(
      `✅ **Votre message a été posté anonymement dans <#${targetChannel.id}> !**\n` +
      `🔒 Votre identité reste strictement confidentielle.`
    ).catch(() => {});
  } catch (err) {
    logger.error(`[Relay:AnonymousDM] Erreur lors de l'envoi dans #${targetChannel.name} :`, err);
    await message.reply("❌ Une erreur est survenue lors de l'envoi de votre message anonyme.").catch(() => {});
  }
}
