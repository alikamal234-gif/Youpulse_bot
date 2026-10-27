import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAttachmentSizes,
  buildChannelToDmEmbed
} from "../src/services/messageRelay.js";

test("Service Relay : Validation de la taille des pièces jointes", async (t) => {
  await t.test("Accepte les pièces jointes de taille inférieure ou égale à 25 Mo", () => {
    const validFiles = [
      { name: "photo.jpg", size: 1024 * 1024 }, // 1 Mo
      { name: "archive.zip", size: 25 * 1024 * 1024 } // 25 Mo pile
    ];
    const res = validateAttachmentSizes(validFiles);
    assert.equal(res.valid, true);
    assert.equal(res.oversizedFiles.length, 0);
  });

  await t.test("Rejette et signale les pièces jointes dépassant 25 Mo", () => {
    const invalidFiles = [
      { name: "video.mp4", size: 30 * 1024 * 1024 }, // 30 Mo
      { name: "petit.png", size: 500 }
    ];
    const res = validateAttachmentSizes(invalidFiles);
    assert.equal(res.valid, false);
    assert.equal(res.oversizedFiles.length, 1);
    assert.match(res.oversizedFiles[0], /video\.mp4/);
  });

  await t.test("Gère un tableau vide de pièces jointes sans erreur", () => {
    const res = validateAttachmentSizes([]);
    assert.equal(res.valid, true);
    assert.equal(res.oversizedFiles.length, 0);
  });
});

test("Service Relay : Construction de l'Embed de notification", async (t) => {
  const mockMessage = {
    id: "998877665544332211",
    url: "https://discord.com/channels/1/2/998877665544332211",
    createdAt: new Date("2026-10-27T12:00:00Z"),
    content: "Bonjour tout le monde ! 🚀🔥 <:custom_smile:123456789>",
    author: {
      username: "alice",
      displayName: "Alice Dev",
      tag: "alice#0001",
      displayAvatarURL: () => "https://cdn.discordapp.com/avatars/1/avatar.png"
    },
    member: {
      displayName: "Alice Dev"
    },
    channel: {
      name: "general"
    },
    guild: {
      name: "Mon Serveur Test"
    },
    attachments: new Map()
  };

  await t.test("Préserve le contenu texte et les emojis (Unicode et personnalisés)", () => {
    const embed = buildChannelToDmEmbed(mockMessage);
    assert.equal(embed.data.description, "Bonjour tout le monde ! 🚀🔥 <:custom_smile:123456789>");
    assert.match(embed.data.author.name, /Alice Dev dans #general/);
    assert.equal(embed.data.author.icon_url, "https://cdn.discordapp.com/avatars/1/avatar.png");
  });

  await t.test("Assigne l'image principale lorsque des pièces jointes image sont fournies", () => {
    const messageWithImage = {
      ...mockMessage,
      content: "",
      attachments: new Map([
        [
          "1",
          {
            name: "capture.png",
            url: "https://cdn.discordapp.com/attachments/1/capture.png",
            size: 2048,
            contentType: "image/png"
          }
        ]
      ])
    };

    const embed = buildChannelToDmEmbed(messageWithImage);
    assert.equal(embed.data.image.url, "https://cdn.discordapp.com/attachments/1/capture.png");
    assert.match(embed.data.description, /pièces jointes/);
  });

  await t.test("Tronque élégamment les messages extrêmement longs (>4000 caractères)", () => {
    const veryLongText = "A".repeat(4500);
    const longMessage = {
      ...mockMessage,
      content: veryLongText
    };

    const embed = buildChannelToDmEmbed(longMessage);
    assert.ok(embed.data.description.length <= 4000);
    assert.ok(embed.data.description.endsWith("..."));
  });
});
