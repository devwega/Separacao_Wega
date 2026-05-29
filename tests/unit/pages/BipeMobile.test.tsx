import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import BipeMobile from "@/pages/BipeMobile";

function renderPage() {
  const { hook } = memoryLocation({ path: "/bipe-mobile" });
  return render(
    <Router hook={hook}>
      <TooltipProvider>
        <BipeMobile />
      </TooltipProvider>
    </Router>,
  );
}

describe("<BipeMobile />", () => {
  it("renderiza o header com número do pedido e cliente", () => {
    renderPage();
    expect(screen.getByText("PV-2024-00187")).toBeInTheDocument();
    expect(
      screen.getByText("Supermercado Bom Preço Ltda"),
    ).toBeInTheDocument();
  });

  it("mostra contador de itens 2/6 no header", () => {
    renderPage();
    expect(screen.getByText("2/6")).toBeInTheDocument();
  });

  it("indica progresso percentual no cabeçalho", () => {
    renderPage();
    // 2 conformes de 6 = 33%
    expect(screen.getByText(/33%/)).toBeInTheDocument();
  });

  it("apresenta o botão Voltar para a tela desktop", () => {
    renderPage();
    expect(screen.getByText(/Voltar/i)).toBeInTheDocument();
  });

  it("destaca o item atual com descrição e código", () => {
    renderPage();
    expect(
      screen.getByText("Linguiça Toscana 500g - Marca A"),
    ).toBeInTheDocument();
    expect(screen.getByText("PRD-001300")).toBeInTheDocument();
  });

  it("renderiza o input grande de bipagem com autoFocus e teclado numérico", () => {
    renderPage();
    const input = screen.getByPlaceholderText(/Bipe ou digite o código EAN/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("inputmode", "numeric");
  });

  it("renderiza os 4 campos complementares (lote, validade, qtd separada, faltante)", () => {
    renderPage();
    expect(screen.getByPlaceholderText("Nº do lote")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("0").length).toBe(2);
  });

  it("renderiza os botões principais de ação (Confirmar / Divergência / Falta)", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /Confirmar Item Conforme/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Divergência/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Falta$/i }),
    ).toBeInTheDocument();
  });

  it("renderiza o trigger do drawer 'Ver todos os itens do pedido'", () => {
    renderPage();
    expect(
      screen.getByText(/Ver todos os itens do pedido/i),
    ).toBeInTheDocument();
  });

  it("mostra o badge 'Protótipo Mobile'", () => {
    renderPage();
    expect(screen.getByText(/Protótipo Mobile/i)).toBeInTheDocument();
  });
});
