/**
 * Commande /annonime - Alias de /anonyme.
 * Permet à n'importe quel membre du serveur d'envoyer un message 100% anonyme
 * dans le salon dédié (#anonyme / #annonime) sans que son identité soit révélée.
 */
import { SlashCommandBuilder } from "discord.js";
import { execute as executeAnonyme, findAnonymousChannel } from "./anonyme.js";

export const data = new SlashCommandBuilder()
  .setName("annonime")
  .setDescription("Envoie un message 100% anonyme dans le salon #anonyme (alias de /anonyme).")
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

export const execute = executeAnonyme;
export { findAnonymousChannel };
