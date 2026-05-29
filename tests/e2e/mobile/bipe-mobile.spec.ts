import { expect, test } from "../fixtures";

test.describe("Tela BIPE Mobile — fullscreen sem sidebar", () => {
  test("a rota /bipe-mobile renderiza sem AppLayout", async ({ page }) => {
    await page.goto("/bipe-mobile");
    // A rota mobile não deve mostrar a sidebar
    await expect(page.locator("aside")).toHaveCount(0);
  });

  test("a página carrega conteúdo principal", async ({ page }) => {
    await page.goto("/bipe-mobile");
    await expect(page.locator("body")).toBeVisible();
    // Página inteira ocupa o viewport
    const root = page.locator("#root");
    await expect(root).toBeVisible();
  });
});
