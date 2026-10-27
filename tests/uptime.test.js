import test from "node:test";
import assert from "node:assert/strict";
import { formatUptime } from "../src/commands/uptime.js";

test("Commande Uptime : Formatage lisible de la durée", async (t) => {
  await t.test("Formate correctement les secondes seules", () => {
    assert.equal(formatUptime(45), "45s");
  });

  await t.test("Formate les minutes et secondes", () => {
    assert.equal(formatUptime(125), "2m 5s");
  });

  await t.test("Formate les heures, minutes et secondes", () => {
    assert.equal(formatUptime(3665), "1h 1m 5s");
  });

  await t.test("Formate les jours, heures, minutes et secondes", () => {
    assert.equal(formatUptime(90061), "1j 1h 1m 1s");
  });

  await t.test("Gère le zéro seconde", () => {
    assert.equal(formatUptime(0), "0s");
  });
});
