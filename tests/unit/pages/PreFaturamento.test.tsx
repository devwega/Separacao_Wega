import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import PreFaturamento from "@/pages/PreFaturamento";

function renderPage() {
  return render(
    <TooltipProvider>
      <PreFaturamento />
    </TooltipProvider>,
  );
}

describe("<PreFaturamento />", () => {
  it("renderiza o resumo do pedido com número e cliente", () => {
    renderPage();
    expect(screen.getAllByText("PV-2024-00190").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Distribuidora Norte Alimentos").length,
    ).toBeGreaterThan(0);
  });

  it("exibe metadados do pedido (embarcação, horário, responsável)", () => {
    renderPage();
    expect(screen.getByText("EMB-043")).toBeInTheDocument();
    expect(screen.getByText(/08:00/)).toBeInTheDocument();
    expect(screen.getAllByText(/Maria Santos/i).length).toBeGreaterThan(0);
  });

  it("renderiza summary cards de KPIs", () => {
    renderPage();
    // Os textos exatos dos cards estão na tela
    expect(screen.getAllByText(/Conformes/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Substituídos/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Faltas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Fluxo Distinto/i).length).toBeGreaterThan(0);
  });

  it("lista itens conformes com lote e validade", () => {
    renderPage();
    expect(screen.getByText("PRD-001100")).toBeInTheDocument();
    expect(screen.getByText("L2024-0451")).toBeInTheDocument();
    expect(screen.getByText("15/08/2026")).toBeInTheDocument();
  });

  it("mostra itens substituídos com original e substituto", () => {
    renderPage();
    expect(
      screen.getByText("Linguiça Toscana 500g - Marca A"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Linguiça Toscana 500g - Marca B"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Hambúrguer Bovino 56g cx c/36"),
    ).toBeInTheDocument();
  });

  it("apresenta itens em falta com ação proposta", () => {
    renderPage();
    expect(screen.getByText("Mortadela Bologna 3,5kg")).toBeInTheDocument();
    expect(screen.getByText("Bacon Defumado Manta 3kg")).toBeInTheDocument();
    expect(screen.getAllByText(/Compra padrão/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Corte/i).length).toBeGreaterThan(0);
  });

  it("renderiza seção de fluxo distinto com aprovador", () => {
    renderPage();
    expect(screen.getByText(/Roberto Gerente/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Contrato do cliente exige item original na NF/i),
    ).toBeInTheDocument();
  });

  it("alerta sobre pendências impeditivas", () => {
    renderPage();
    expect(screen.getAllByText(/Falta em compra/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Aguardando retorno de compra padrão/i),
    ).toBeInTheDocument();
  });
});
