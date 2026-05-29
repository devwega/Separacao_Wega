import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";

describe("<Home />", () => {
  it("é um alias para PedidosLiberados — renderiza o título da página", () => {
    render(
      <TooltipProvider>
        <Home />
      </TooltipProvider>,
    );
    expect(
      screen.getByRole("heading", {
        name: /Pedidos Liberados para Separação/i,
      }),
    ).toBeInTheDocument();
  });
});
