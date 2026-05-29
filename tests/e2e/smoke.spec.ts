import { expect, test } from "./fixtures";

test.describe("Smoke — carregamento básico", () => {
  test("a aplicação carrega na rota raiz", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("AppLayout renderiza sidebar com Troca de Itens", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Troca de Itens").first()).toBeVisible();
    await expect(page.getByText("Sankhya ERP")).toBeVisible();
  });

  test("breadcrumb mostra a tela atual", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Pedidos Liberados").first()).toBeVisible();
  });

  test("rota inexistente cai em NotFound dentro do layout", async ({ page }) => {
    await page.goto("/uma-rota-inexistente-xyz");
    await expect(page.locator("aside")).toBeVisible();
  });
});
