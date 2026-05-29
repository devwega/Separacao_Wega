import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import DivergenciasTrocas from "@/pages/DivergenciasTrocas";

function renderPage() {
  return render(
    <TooltipProvider>
      <DivergenciasTrocas />
    </TooltipProvider>,
  );
}

describe("<DivergenciasTrocas />", () => {
  it("renderiza o título da página e descrição", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /Divergências e Trocas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Analise e decida sobre itens divergentes/i),
    ).toBeInTheDocument();
  });

  it("renderiza os 4 summary cards com totais corretos do mock", () => {
    renderPage();
    expect(screen.getByText("Total Divergências")).toBeInTheDocument();
    expect(screen.getByText("Homologadas")).toBeInTheDocument();
    expect(screen.getByText("Não Homologadas")).toBeInTheDocument();
    expect(screen.getByText("Por Proporção")).toBeInTheDocument();
  });

  it("exibe o campo de busca por pedido, item ou cliente", () => {
    renderPage();
    expect(
      screen.getByPlaceholderText(/Buscar por pedido, item ou cliente/i),
    ).toBeInTheDocument();
  });

  it("renderiza cards das 4 divergências do mock", () => {
    renderPage();
    expect(screen.getAllByText("PV-2024-00187").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText("PV-2024-00190").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText("PV-2024-00192").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("mostra os itens originais e substitutos das divergências", () => {
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
    expect(
      screen.getByText("Hambúrguer Bovino 56g cx c/12"),
    ).toBeInTheDocument();
  });

  it("indica fator de conversão para divergências de proporção", () => {
    renderPage();
    expect(screen.getByText(/Fator: 1:3/)).toBeInTheDocument();
  });

  it("classifica divergências como homologadas ou não homologadas", () => {
    renderPage();
    expect(screen.getAllByText(/^Homologada$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Não Homologada$/)).toBeInTheDocument();
  });

  it("renderiza botões de ação 'Aprovar Troca' e 'Reprovar' para pendências", () => {
    renderPage();
    expect(screen.getAllByText(/Aprovar Troca/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Reprovar$/i).length).toBeGreaterThan(0);
  });

  it("exibe estado 'Troca aprovada pelo comercial' para divergências conformes", () => {
    renderPage();
    expect(
      screen.getByText(/Troca aprovada pelo comercial/i),
    ).toBeInTheDocument();
  });

  it("destaca necessidade de aprovação obrigatória do cliente", () => {
    renderPage();
    expect(
      screen.getAllByText(/Aprovação obrigatória/i).length,
    ).toBeGreaterThan(0);
  });
});
