import test from "node:test";
import assert from "node:assert/strict";
import { moderateAnonymousMessage } from "../src/services/aiModeration.js";

test("Service AI Moderation : Validation contextuelle YouCode & BDE", async (t) => {
  await t.test("Autorise les messages vides (ex: upload image seule sans texte)", async () => {
    const result = await moderateAnonymousMessage("");
    assert.equal(result.allowed, true);
  });

  await t.test("Autorise les messages avec juste des espaces", async () => {
    const result = await moderateAnonymousMessage("    ");
    assert.equal(result.allowed, true);
  });

  await t.test("Détecte et autorise un message d'entraide scolaire ou hackathon", async () => {
    const result = await moderateAnonymousMessage("drary chkon 3ndo chi correction ola astuce dyal brief React ?");
    assert.equal(result.allowed, true);
  });

  await t.test("Détecte et refuse un message publicitaire ou hors contexte", async () => {
    const result = await moderateAnonymousMessage("Achetez des cryptomonnaies bitcoin pas cher rendement 200%");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.length > 0);
  });
});
