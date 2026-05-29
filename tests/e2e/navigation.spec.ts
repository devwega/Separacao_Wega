import { expect, test } from "./fixtures";

test.describe("Navegação entre telas via sidebar", () => {
  test("navega Pedidos → BIPE → Divergências → Faltas → Fluxo Distinto → Pré-Faturamento", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /BIPE Separação/i }).click();
    await expect(page).toHaveURL(/\/bipe$/);

    await page.getByRole("link", { name: /Divergências e Trocas/i }).click();
    await expect(page).toHaveURL(/\/divergencias$/);

    await page.getByRole("link", { name: /Faltas e Apanho/i }).click();
    await expect(page).toHaveURL(/\/faltas$/);

    await page.getByRole("link", { name: /Fluxo Distinto/i }).click();
    await expect(page).toHaveURL(/\/fluxo-distinto$/);

    await page.getByRole("link", { name: /Pré-Faturamento/i }).click();
    await expect(page).toHaveURL(/\/pre-faturamento$/);

    await page.getByRole("link", { name: /Pedidos Liberados/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("botão de colapsar a sidebar funciona", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside").first();
    const initialWidth = await sidebar.evaluate((el) => el.clientWidth);

    await page.getByRole("button", { name: /Recolher/i }).click();
    // após colapsar, o aside fica mais estreito
    await expect
      .poll(async () => sidebar.evaluate((el) => el.clientWidth))
      .toBeLessThan(initialWidth);
  });
});
