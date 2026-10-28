import test from "node:test";
import assert from "node:assert/strict";
import { moderateAnonymousMessage, hasProfanity } from "../src/services/aiModeration.js";

test("Service AI Moderation : Détection des insultes et vulgarités (hasProfanity)", async (t) => {
  await t.test("Détecte les insultes en Darija (latin/arabizi)", () => {
    assert.equal(hasProfanity("sir a weld l97ba"), true);
    assert.equal(hasProfanity("had lbrief zbi"), true);
    assert.equal(hasProfanity("nta 7mar"), true);
    assert.equal(hasProfanity("wahed l kelb"), true);
    assert.equal(hasProfanity("sir t9owed"), true);
    assert.equal(hasProfanity("sir tkhra"), true);
  });

  await t.test("Détecte les insultes en Français et Anglais", () => {
    assert.equal(hasProfanity("espèce de connard"), true);
    assert.equal(hasProfanity("what the fuck is this"), true);
  });

  await t.test("Ne bloque pas les mots normaux et respectueux", () => {
    assert.equal(hasProfanity("Salam ldrary kif dayrin"), false);
    assert.equal(hasProfanity("Merci beaucoup pour l'aide sur React"), false);
    assert.equal(hasProfanity("hello"), false);
  });
});

test("Service AI Moderation : Validation contextuelle conviviale et sécurisée", async (t) => {
  await t.test("Autorise les messages vides (ex: upload image seule sans texte)", async () => {
    const result = await moderateAnonymousMessage("");
    assert.equal(result.allowed, true);
  });

  await t.test("Autorise les messages avec juste des espaces", async () => {
    const result = await moderateAnonymousMessage("    ");
    assert.equal(result.allowed, true);
  });

  await t.test("Autorise les salutations simples et courtoises (hello, salam)", async () => {
    const resultHello = await moderateAnonymousMessage("hello");
    assert.equal(resultHello.allowed, true);

    const resultSalam = await moderateAnonymousMessage("Salam ldrary cv ?");
    assert.equal(resultSalam.allowed, true);
  });

  await t.test("Autorise les questions normales de la vie quotidienne entre étudiants", async () => {
    const result = await moderateAnonymousMessage("Chkon hna 3ndo chi fikra 3la chi film mzyan netferrej fih ?");
    assert.equal(result.allowed, true);
  });

  await t.test("Détecte et autorise une activité du BDE ou entraide scolaire", async () => {
    const result = await moderateAnonymousMessage("Salam ldrary wach kayn chi tournoi FIFA li ghaydir l BDE ce weekend ?");
    assert.equal(result.allowed, true);
  });

  await t.test("Détecte et refuse le spam commercial (ex: vente moto)", async () => {
    const result = await moderateAnonymousMessage("Bghit nchri moto sh 125 chkon 3ndo chi w7da n9iya ?");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.length > 0);
  });

  await t.test("Refuse catégoriquement les insultes en Darija", async () => {
    const result = await moderateAnonymousMessage("L BDE kamlin wlad l97ba");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.length > 0);
  });
});
