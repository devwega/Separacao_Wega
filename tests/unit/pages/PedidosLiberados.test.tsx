import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import PedidosLiberados from "@/pages/PedidosLiberados";

function renderPage() {
  return render(
    <TooltipProvider>
      <PedidosLiberados />
    </TooltipProvider>,
  );
}

describe("<PedidosLiberados />", () => {
  it("exibe o título e descrição da página", () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        name: /Pedidos Liberados para Separação/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Gerencie e priorize os pedidos liberados/i),
    ).toBeInTheDocument();
  });

  it("renderiza os 4 summary cards com os totais do mock", () => {
    renderPage();
    expect(screen.getByText("Total Pedidos")).toBeInTheDocument();
    // "Em Separação" aparece como título do card e também como status na tabela
    expect(screen.getAllByText("Em Separação").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Com Pendências")).toBeInTheDocument();
    expect(screen.getByText("Concluídos")).toBeInTheDocument();
  });

  it("renderiza todos os pedidos mockados na tabela", () => {
    renderPage();
    expect(screen.getByText("PV-2024-00187")).toBeInTheDocument();
    expect(screen.getByText("PV-2024-00188")).toBeInTheDocument();
    expect(screen.getByText("PV-2024-00189")).toBeInTheDocument();
    expect(screen.getByText("PV-2024-00190")).toBeInTheDocument();
    expect(screen.getByText("PV-2024-00191")).toBeInTheDocument();
    expect(screen.getByText("PV-2024-00192")).toBeInTheDocument();
  });

  it("mostra o badge CRÍTICO para o pedido bloqueado prioridade crítica", () => {
    renderPage();
    expect(screen.getByText("CRÍTICO")).toBeInTheDocument();
  });

  it("mostra ao menos um badge ALTA", () => {
    renderPage();
    expect(screen.getAllByText("ALTA").length).toBeGreaterThan(0);
  });

  it("exibe o input de busca", () => {
    renderPage();
    expect(
      screen.getByPlaceholderText(/Buscar pedido ou cliente/i),
    ).toBeInTheDocument();
  });

  it("renderiza cabeçalhos da tabela", () => {
    renderPage();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Pedido")).toBeInTheDocument();
    expect(within(table).getByText("Cliente")).toBeInTheDocument();
    expect(within(table).getByText("Status")).toBeInTheDocument();
    expect(within(table).getByText("Progresso")).toBeInTheDocument();
  });
});
