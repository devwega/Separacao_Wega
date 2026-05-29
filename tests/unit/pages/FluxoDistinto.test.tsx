import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import FluxoDistinto from "@/pages/FluxoDistinto";

function renderPage() {
  return render(
    <TooltipProvider>
      <FluxoDistinto />
    </TooltipProvider>,
  );
}

describe("<FluxoDistinto />", () => {
  it("renderiza o título e descrição da página", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /Aprovação de Fluxo Distinto/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aprove exceções onde o item físico expedido difere/i),
    ).toBeInTheDocument();
  });

  it("exibe o banner de alerta sobre restrição de aprovação", () => {
    renderPage();
    expect(
      screen.getByText(/Aprovação restrita a Supervisor ou Gerente/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/movimentos compensatórios de estoque/i),
    ).toBeInTheDocument();
  });

  it("lista os fluxos distintos do mock com pedido e cliente", () => {
    renderPage();
    expect(screen.getByText("PV-2024-00190")).toBeInTheDocument();
    expect(
      screen.getByText("Distribuidora Norte Alimentos"),
    ).toBeInTheDocument();
    expect(screen.getByText("PV-2024-00192")).toBeInTheDocument();
    expect(
      screen.getByText("Hortifruti Natural da Terra"),
    ).toBeInTheDocument();
  });

  it("apresenta a comparação item NF vs item físico", () => {
    renderPage();
    expect(
      screen.getAllByText(/Linguiça Toscana 500g - Marca A/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Linguiça Toscana 500g - Marca B/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Peito de Peru Defumado 3,5kg/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Peito de Peru Defumado 4kg/i).length,
    ).toBeGreaterThan(0);
  });

  it("mostra solicitante e data da solicitação", () => {
    renderPage();
    expect(screen.getByText(/Maria Santos.*Comercial/i)).toBeInTheDocument();
    expect(screen.getByText(/Ana Oliveira.*Comercial/i)).toBeInTheDocument();
    expect(screen.getByText("14/05/2026 07:15")).toBeInTheDocument();
    expect(screen.getByText("14/05/2026 08:30")).toBeInTheDocument();
  });

  it("exibe justificativas dos fluxos", () => {
    renderPage();
    expect(
      screen.getByText(/Marca A com estoque zerado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Gramatura 3,5kg esgotada/i),
    ).toBeInTheDocument();
  });

  it("mostra histórico de eventos do fluxo", () => {
    renderPage();
    expect(
      screen.getByText(/Divergência identificada na separação/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cliente informado e aprovou substituição/i),
    ).toBeInTheDocument();
  });

  it("descreve impacto da aprovação (movimento compensatório)", () => {
    renderPage();
    expect(
      screen.getAllByText(/Movimento compensatório/i).length,
    ).toBeGreaterThan(0);
  });
});
