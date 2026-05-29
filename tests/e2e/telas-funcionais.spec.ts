import { expect, test } from "./fixtures";

test.describe("Tela 9.2 — BIPE de Separação", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/bipe");
  });

  test("header do pedido visível", async ({ page }) => {
    await expect(page.getByText("PV-2024-00187")).toBeVisible();
  });

  test("painel de bipagem com campo EAN", async ({ page }) => {
    await expect(
      page.getByPlaceholder(/Bipe ou digite o código EAN/i),
    ).toBeVisible();
  });

  test("botões de confirmação/divergência/falta presentes", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Confirmar Item Conforme/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Registrar Divergência/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Registrar Falta/i }),
    ).toBeVisible();
  });
});

test.describe("Tela 9.3 — Divergências e Trocas", () => {
  test("carrega sem erro", async ({ page }) => {
    await page.goto("/divergencias");
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Tela 9.4 — Faltas e Apanho", () => {
  test("carrega sem erro", async ({ page }) => {
    await page.goto("/faltas");
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Tela 9.5 — Fluxo Distinto", () => {
  test("carrega sem erro", async ({ page }) => {
    await page.goto("/fluxo-distinto");
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Tela 9.6 — Pré-Faturamento", () => {
  test("carrega sem erro", async ({ page }) => {
    await page.goto("/pre-faturamento");
    await expect(page.locator("main")).toBeVisible();
  });
});
