import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import FaltasApanho from "@/pages/FaltasApanho";

function renderPage() {
  return render(
    <TooltipProvider>
      <FaltasApanho />
    </TooltipProvider>,
  );
}

describe("<FaltasApanho />", () => {
  it("renderiza o título e descrição da página", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /Faltas e Apanho/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Trate indisponibilidades de estoque/i),
    ).toBeInTheDocument();
  });

  it("renderiza os 4 summary cards de KPI", () => {
    renderPage();
    expect(screen.getByText("Total Faltas")).toBeInTheDocument();
    expect(screen.getByText("Apanho Ativo")).toBeInTheDocument();
    expect(screen.getByText("Compra Padrão")).toBeInTheDocument();
    expect(screen.getByText("Sem Tratativa")).toBeInTheDocument();
  });

  it("exibe os filtros de busca e selects (Criticidade, Tipo, Ação)", () => {
    renderPage();
    expect(
      screen.getByPlaceholderText(/Buscar item ou pedido/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Criticidade/i)).toBeInTheDocument();
    expect(screen.getByText(/Tipo de falta/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ação/i).length).toBeGreaterThan(0);
  });

  it("lista todas as 4 faltas do mock com seus itens", () => {
    renderPage();
    expect(screen.getByText("Mortadela Bologna 3,5kg")).toBeInTheDocument();
    expect(
      screen.getByText("Presunto Cozido Fatiado 200g"),
    ).toBeInTheDocument();
    expect(screen.getByText("Queijo Mussarela Peça 4kg")).toBeInTheDocument();
    expect(screen.getByText("Bacon Defumado Manta 3kg")).toBeInTheDocument();
  });

  it("apresenta criticidade dos itens (Crítica, Alta, Média)", () => {
    renderPage();
    expect(screen.getAllByText(/Crítica/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Alta$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Média$/i).length).toBeGreaterThan(0);
  });

  it("distingue faltas totais e parciais via badges", () => {
    renderPage();
    expect(screen.getAllByText(/Falta total/i).length).toBe(2);
    expect(screen.getAllByText(/Falta parcial/i).length).toBe(2);
  });

  it("mostra informação de embarcação e horário de carregamento", () => {
    renderPage();
    expect(screen.getAllByText("EMB-043").length).toBeGreaterThan(0);
    expect(screen.getByText("EMB-044")).toBeInTheDocument();
    expect(screen.getByText("EMB-042")).toBeInTheDocument();
  });

  it("indica ações já aplicadas (Apanho / Compra Padrão)", () => {
    renderPage();
    // No mock, item 2 está com Apanho e item 3 com Compra padrão
    expect(screen.getAllByText(/^Apanho$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Compra Padrão/i).length).toBeGreaterThan(0);
  });

  it("oferece botões de tratativa para faltas sem ação proposta", () => {
    renderPage();
    // Faltas 1 e 4 não têm acaoProposta
    expect(screen.getAllByText(/Corte/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Informar Previsão/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Devolver ao Comercial/i).length,
    ).toBeGreaterThan(0);
  });

  it("destaca tempo restante crítico (15min)", () => {
    renderPage();
    expect(screen.getByText("15min")).toBeInTheDocument();
  });
});
