import { render, screen } from "@testing-library/react";
import { Package, AlertTriangle } from "lucide-react";
import { describe, expect, it } from "vitest";
import SummaryCard from "@/components/SummaryCard";

describe("<SummaryCard />", () => {
  it("renderiza título, valor e subtítulo", () => {
    render(
      <SummaryCard
        icon={Package}
        title="Total Pedidos"
        value={42}
        subtitle="Liberados hoje"
      />,
    );
    expect(screen.getByText("Total Pedidos")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Liberados hoje")).toBeInTheDocument();
  });

  it("aceita value como string", () => {
    render(<SummaryCard icon={Package} title="Status" value="OK" />);
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("omite o subtítulo quando não passado", () => {
    const { container } = render(
      <SummaryCard icon={Package} title="Pedidos" value={0} />,
    );
    expect(container.textContent).toContain("Pedidos");
    expect(container.textContent).toContain("0");
  });

  it("aplica cores customizadas do ícone", () => {
    const { container } = render(
      <SummaryCard
        icon={AlertTriangle}
        title="Pendências"
        value={3}
        iconColor="text-amber-600"
        iconBg="bg-amber-50"
      />,
    );
    expect(container.innerHTML).toContain("text-amber-600");
    expect(container.innerHTML).toContain("bg-amber-50");
  });

  it("aplica className extra", () => {
    const { container } = render(
      <SummaryCard icon={Package} title="X" value={1} className="custom-card" />,
    );
    expect(container.firstChild).toHaveClass("custom-card");
  });
});
