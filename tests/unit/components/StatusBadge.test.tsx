import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusBadge from "@/components/StatusBadge";

describe("<StatusBadge />", () => {
  it("renderiza o label padrão para 'conforme'", () => {
    render(<StatusBadge status="conforme" />);
    expect(screen.getByText("Conforme")).toBeInTheDocument();
  });

  it("renderiza o label padrão para 'pendente'", () => {
    render(<StatusBadge status="pendente" />);
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("permite sobrescrever o label", () => {
    render(<StatusBadge status="separacao" label="Em andamento" />);
    expect(screen.getByText("Em andamento")).toBeInTheDocument();
    expect(screen.queryByText("Em Separação")).not.toBeInTheDocument();
  });

  it("aplica a paleta correta para status 'bloqueado'", () => {
    render(<StatusBadge status="bloqueado" />);
    const badge = screen.getByText("Bloqueado");
    expect(badge.className).toMatch(/bg-red-50/);
    expect(badge.className).toMatch(/text-red-700/);
  });

  it("aplica classes de tamanho 'md'", () => {
    render(<StatusBadge status="info" size="md" />);
    const badge = screen.getByText("Informativo");
    expect(badge.className).toMatch(/px-3/);
    expect(badge.className).toMatch(/text-xs/);
  });

  it("aplica classes de tamanho 'sm' (padrão)", () => {
    render(<StatusBadge status="info" />);
    const badge = screen.getByText("Informativo");
    expect(badge.className).toMatch(/px-2/);
    expect(badge.className).toMatch(/text-\[11px\]/);
  });

  it("aceita className extra sem perder a paleta", () => {
    render(<StatusBadge status="conforme" className="ml-4" />);
    const badge = screen.getByText("Conforme");
    expect(badge.className).toMatch(/ml-4/);
    expect(badge.className).toMatch(/bg-emerald-50/);
  });

  it.each([
    ["conforme"],
    ["pendente"],
    ["bloqueado"],
    ["distinto"],
    ["info"],
    ["separacao"],
    ["faturado"],
    ["lancado"],
    ["falta"],
  ] as const)("renderiza sem erros para status '%s'", (status) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(container.firstChild).not.toBeNull();
  });
});
