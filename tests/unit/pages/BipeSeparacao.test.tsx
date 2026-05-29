import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import BipeSeparacao from "@/pages/BipeSeparacao";

function renderPage() {
  return render(
    <TooltipProvider>
      <BipeSeparacao />
    </TooltipProvider>,
  );
}

describe("<BipeSeparacao />", () => {
  it("renderiza o cabeçalho do pedido com número e cliente", () => {
    renderPage();
    expect(screen.getByText("PV-2024-00187")).toBeInTheDocument();
    expect(
      screen.getByText("Supermercado Bom Preço Ltda"),
    ).toBeInTheDocument();
  });

  it("exibe metadados do pedido (embarcação, horário, responsável)", () => {
    renderPage();
    expect(screen.getByText("EMB-042")).toBeInTheDocument();
    expect(screen.getByText("06:30h")).toBeInTheDocument();
    expect(screen.getByText("Carlos Silva")).toBeInTheDocument();
  });

  it("mostra contador de progresso 2 de 6 itens", () => {
    renderPage();
    expect(screen.getByText("2 de 6 itens")).toBeInTheDocument();
  });

  it("lista todos os itens do pedido na coluna esquerda", () => {
    renderPage();
    expect(screen.getByText("PRD-001245")).toBeInTheDocument();
    expect(screen.getByText("PRD-001246")).toBeInTheDocument();
    expect(screen.getByText("PRD-001300")).toBeInTheDocument();
    expect(screen.getByText("PRD-001455")).toBeInTheDocument();
    expect(screen.getByText("PRD-001500")).toBeInTheDocument();
    expect(screen.getByText("PRD-001612")).toBeInTheDocument();
  });

  it("renderiza o painel de bipagem com input de EAN", () => {
    renderPage();
    expect(
      screen.getByPlaceholderText(/Bipe ou digite o código EAN/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Leitura do EAN/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("exibe o item atual em destaque com EAN esperado", () => {
    renderPage();
    expect(
      screen.getByText("Linguiça Toscana 500g - Marca A"),
    ).toBeInTheDocument();
    expect(screen.getByText(/7891234567892/)).toBeInTheDocument();
  });

  it("renderiza os campos de lote, validade, qtd separada e faltante", () => {
    renderPage();
    expect(screen.getByPlaceholderText("Nº do lote")).toBeInTheDocument();
    // Há 2 inputs com placeholder "0" (qtd separada e faltante)
    expect(screen.getAllByPlaceholderText("0").length).toBe(2);
  });

  it("mostra o saldo reservado de estoque", () => {
    renderPage();
    expect(screen.getByText(/Saldo reservado no estoque/i)).toBeInTheDocument();
    expect(screen.getByText("23 un")).toBeInTheDocument();
  });

  it("renderiza os três botões de ação principais", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /Confirmar Item Conforme/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Registrar Divergência/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Registrar Falta/i }),
    ).toBeInTheDocument();
  });

  it("exibe a seção de validação visual com EAN, Lote, Validade e Equivalência", () => {
    renderPage();
    expect(screen.getByText(/Resultado da Validação/i)).toBeInTheDocument();
    expect(screen.getByText("EAN")).toBeInTheDocument();
    expect(screen.getByText("Lote")).toBeInTheDocument();
    expect(screen.getByText("Validade")).toBeInTheDocument();
    expect(screen.getByText("Equivalência")).toBeInTheDocument();
  });
});
