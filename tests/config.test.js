import test from "node:test";
import assert from "node:assert/strict";
import { isValidSnowflake } from "../src/config.js";

test("Module Config : Validation des identifiants Discord (Snowflakes)", async (t) => {
  await t.test("Reconnaît les flocons valides (17 à 20 chiffres)", () => {
    assert.equal(isValidSnowflake("12345678901234567"), true); // 17 chiffres
    assert.equal(isValidSnowflake("123456789012345678"), true); // 18 chiffres
    assert.equal(isValidSnowflake("1234567890123456789"), true); // 19 chiffres
    assert.equal(isValidSnowflake("12345678901234567890"), true); // 20 chiffres
  });

  await t.test("Rejette les identifiants avec des lettres ou symboles", () => {
    assert.equal(isValidSnowflake("12345678901234567a"), false);
    assert.equal(isValidSnowflake("token-with-special-chars!"), false);
    assert.equal(isValidSnowflake("1234567890 12345678"), false);
  });

  await t.test("Rejette les identifiants trop courts ou trop longs", () => {
    assert.equal(isValidSnowflake("1234567890123456"), false); // 16 chiffres
    assert.equal(isValidSnowflake("123456789012345678901"), false); // 21 chiffres
    assert.equal(isValidSnowflake(""), false);
  });

  await t.test("Rejette les types non-string", () => {
    assert.equal(isValidSnowflake(null), false);
    assert.equal(isValidSnowflake(123456789), false);
    assert.equal(isValidSnowflake(123456789012345678n), false);
    assert.equal(isValidSnowflake({}), false);
  });
});

test("Service ChannelStore : Configuration et Suppression (unset) du salon", async (t) => {
  const { channelStore } = await import("../src/services/channelStore.js");
  const originalChannelId = channelStore.getChannelId();

  await t.test("Définit et sauvegarde un salon valide", () => {
    const success = channelStore.setChannelId("112233445566778899", "TEST_USER");
    assert.equal(success, true);
    assert.equal(channelStore.getChannelId(), "112233445566778899");
    assert.equal(channelStore.isConfigured(), true);
  });

  await t.test("Supprime (unset) le salon avec succès", () => {
    const success = channelStore.unsetChannelId("TEST_USER");
    assert.equal(success, true);
    assert.equal(channelStore.getChannelId(), null);
    assert.equal(channelStore.isConfigured(), false);
  });

  // Restauration de l'état initial pour ne pas perturber l'environnement de dev
  if (originalChannelId) {
    channelStore.setChannelId(originalChannelId, "RESTORE");
  }
});
