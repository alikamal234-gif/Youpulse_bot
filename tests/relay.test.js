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

test("Commande Anonyme : Détection automatique du salon anonyme", async (t) => {
  const { findAnonymousChannel } = await import("../src/commands/anonyme.js");

  await t.test("Trouve le salon 'anonyme' parmi les salons textuels", () => {
    const mockGuild = {
      channels: {
        cache: new Map([
          ["1", { name: "general", isTextBased: () => true }],
          ["2", { name: "anonyme", isTextBased: () => true }],
          ["3", { name: "vocal", isTextBased: () => false }]
        ])
      }
    };
    const found = findAnonymousChannel(mockGuild);
    assert.ok(found);
    assert.equal(found.name, "anonyme");
  });

  await t.test("Trouve les variantes orthographiques ('annonime', 'confessions')", () => {
    const mockGuild = {
      channels: {
        cache: new Map([
          ["1", { name: "general", isTextBased: () => true }],
          ["2", { name: "annonime", isTextBased: () => true }]
        ])
      }
    };
    const found = findAnonymousChannel(mockGuild);
    assert.ok(found);
    assert.equal(found.name, "annonime");
  });

  await t.test("Retourne null si aucun salon anonyme n'existe", () => {
    const mockGuild = {
      channels: {
        cache: new Map([
          ["1", { name: "general", isTextBased: () => true }],
          ["2", { name: "annonces", isTextBased: () => true }]
        ])
      }
    };
    const found = findAnonymousChannel(mockGuild);
    assert.equal(found, null);
  });
});

test("Service Relay : Détection du salon cible et permissions admin", async (t) => {
  const { parseChannelAndMessage, isUserAdminOrOwner } = await import("../src/services/messageRelay.js");

  const mockClient = {
    guilds: {
      cache: new Map([
        [
          "100",
          {
            ownerId: "555555555555555555",
            channels: {
              cache: new Map([
                ["101", { id: "101", name: "general", isTextBased: () => true }],
                ["102", { id: "102", name: "annonces", isTextBased: () => true }],
                ["103", { id: "103", name: "vocal", isTextBased: () => false }]
              ])
            },
            members: {
              cache: new Map([
                [
                  "777777777777777777",
                  {
                    permissions: {
                      has: (perm) => Boolean(perm)
                    }
                  }
                ],
                [
                  "888888888888888888",
                  {
                    permissions: {
                      has: () => false
                    }
                  }
                ]
              ]),
              fetch: async () => null
            }
          }
        ]
      ])
    }
  };

  await t.test("parseChannelAndMessage : extrait #salon et le texte", () => {
    const parsed = parseChannelAndMessage("#general Bonjour tout le monde !", mockClient);
    assert.ok(parsed);
    assert.equal(parsed.channel.name, "general");
    assert.equal(parsed.text, "Bonjour tout le monde !");
  });

  await t.test("parseChannelAndMessage : extrait /send #salon et le texte", () => {
    const parsed = parseChannelAndMessage("/send #annonces Réunion ce soir", mockClient);
    assert.ok(parsed);
    assert.equal(parsed.channel.name, "annonces");
    assert.equal(parsed.text, "Réunion ce soir");
  });

  await t.test("parseChannelAndMessage : extrait <#id> et le texte", () => {
    const parsed = parseChannelAndMessage("<#101> Message direct", mockClient);
    assert.ok(parsed);
    assert.equal(parsed.channel.id, "101");
    assert.equal(parsed.text, "Message direct");
  });

  await t.test("parseChannelAndMessage : retourne null si aucun salon n'est spécifié", () => {
    const parsed = parseChannelAndMessage("Juste un message sans salon", mockClient);
    assert.equal(parsed, null);
  });

  await t.test("isUserAdminOrOwner : reconnaît l'administrateur du serveur", async () => {
    const isAdmin = await isUserAdminOrOwner("777777777777777777", mockClient);
    assert.equal(isAdmin, true);
  });

  await t.test("isUserAdminOrOwner : rejette un membre ordinaire", async () => {
    const isAdmin = await isUserAdminOrOwner("888888888888888888", mockClient);
    assert.equal(isAdmin, false);
  });
});

test("Commande Annonime : Alias vérifié", async () => {
  const annonimeCmd = await import("../src/commands/annonime.js");
  assert.equal(annonimeCmd.data.name, "annonime");
  assert.equal(annonimeCmd.ownerOnly, false);
  assert.equal(typeof annonimeCmd.execute, "function");
});

test("Service Relay : Cadre identique pour messages anonymes (Admin & Membres)", async (t) => {
  const { isAnonymousChannel, buildAnonymousPayload } = await import("../src/services/messageRelay.js");

  await t.test("isAnonymousChannel : détecte les salons anonymes et variantes", () => {
    assert.equal(isAnonymousChannel({ name: "anonyme" }), true);
    assert.equal(isAnonymousChannel({ name: "annonime" }), true);
    assert.equal(isAnonymousChannel({ name: "confessions" }), true);
    assert.equal(isAnonymousChannel({ name: "salon-anonyme-test" }), true);
    assert.equal(isAnonymousChannel({ name: "general" }), false);
    assert.equal(isAnonymousChannel({ name: "annonces" }), false);
    assert.equal(isAnonymousChannel(null), false);
  });

  await t.test("buildAnonymousPayload : produit l'embed cadre identique", () => {
    const payload = buildAnonymousPayload("Ceci est un message test");
    assert.ok(payload.embeds && payload.embeds.length === 1);
    const embed = payload.embeds[0];
    assert.equal(embed.data.title, "🎭 Message Anonyme");
    assert.equal(embed.data.description, "Ceci est un message test");
    assert.equal(embed.data.color, 0x2b2d31);
    assert.equal(embed.data.footer.text, "Message 100% Anonyme • Identité masquée 🔒");
  });

  await t.test("buildAnonymousPayload : nettoie le préfixe /annonime et gère les pièces jointes", () => {
    const payload = buildAnonymousPayload("/annonime mon secret", [
      { name: "photo.png", url: "https://example.com/photo.png", contentType: "image/png" }
    ]);
    const embed = payload.embeds[0];
    assert.equal(embed.data.description, "mon secret");
    assert.equal(embed.data.image.url, "https://example.com/photo.png");
    assert.equal(payload.files.length, 1);
  });
});

