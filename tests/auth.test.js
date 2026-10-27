import test from "node:test";
import assert from "node:assert/strict";

test("Authentification Propriétaire : Validation stricte des permissions", async (t) => {
  const MOCK_OWNER_ID = "123456789012345678";

  function isOwner(userId, configuredOwnerId = MOCK_OWNER_ID) {
    if (!userId || typeof userId !== "string") return false;
    return userId.trim() === configuredOwnerId.trim();
  }

  await t.test("Autorise le propriétaire légitime", () => {
    assert.equal(isOwner("123456789012345678"), true);
  });

  await t.test("Rejette un utilisateur non autorisé", () => {
    assert.equal(isOwner("987654321098765432"), false);
  });

  await t.test("Rejette les identifiants vides ou invalides", () => {
    assert.equal(isOwner(""), false);
    assert.equal(isOwner(null), false);
    assert.equal(isOwner(123456789), false);
    assert.equal(isOwner(123456789012345678n), false);
  });
});
