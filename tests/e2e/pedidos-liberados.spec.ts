import { expect, test } from "./fixtures";

test.describe("Tela 9.1 — Pedidos Liberados", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("título e descrição da página", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Pedidos Liberados para Separação/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Gerencie e priorize os pedidos liberados/i),
    ).toBeVisible();
  });

  test("renderiza os 4 summary cards", async ({ page }) => {
    await expect(page.getByText("Total Pedidos")).toBeVisible();
    await expect(page.getByText("Em Separação")).toBeVisible();
    await expect(page.getByText("Com Pendências")).toBeVisible();
    await expect(page.getByText("Concluídos")).toBeVisible();
  });

  test("tabela lista pedidos do mock", async ({ page }) => {
    await expect(page.getByText("PV-2024-00187")).toBeVisible();
    await expect(page.getByText("PV-2024-00188")).toBeVisible();
    await expect(page.getByText("Supermercado Bom Preço Ltda")).toBeVisible();
  });

  test("filtros estão disponíveis (busca, status, embarcação, prioridade)", async ({
    page,
  }) => {
    await expect(
      page.getByPlaceholder(/Buscar pedido ou cliente/i),
    ).toBeVisible();
    await expect(page.getByText("Status").first()).toBeVisible();
    await expect(page.getByText("Embarcação").first()).toBeVisible();
    await expect(page.getByText("Prioridade").first()).toBeVisible();
  });

  test("input de busca aceita texto", async ({ page }) => {
    const input = page.getByPlaceholder(/Buscar pedido ou cliente/i);
    await input.fill("PV-2024");
    await expect(input).toHaveValue("PV-2024");
  });
});
