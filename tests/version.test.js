import { test } from "node:test";
import assert from "node:assert/strict";
import { versionInstalada } from "../src/interfaz/version.js";

test("la versión proviene del sistema en la app y distingue el navegador", async () => {
  assert.equal(
    await versionInstalada(true, async () => ({
      version: "1.7.3",
      build: "19",
    })),
    "1.7.3",
  );
  assert.equal(
    await versionInstalada(true, async () => {
      throw new Error("sin servicio");
    }),
    "No disponible",
  );
  assert.equal(
    await versionInstalada(true, async () => ({ version: "" })),
    "No disponible",
  );
  assert.equal(
    await versionInstalada(false, async () => {
      throw new Error("no debe consultarse");
    }),
    "Disponible en la aplicación instalada",
  );
});
