import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import NotFound from "@/pages/NotFound";

function renderPage() {
  const { hook } = memoryLocation({ path: "/nao-existe" });
  return render(
    <Router hook={hook}>
      <NotFound />
    </Router>,
  );
}

describe("<NotFound />", () => {
  it("renderiza o título 404", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "404" }),
    ).toBeInTheDocument();
  });

  it("exibe 'Page Not Found' e mensagem explicativa", () => {
    renderPage();
    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    expect(
      screen.getByText(/Sorry, the page you are looking for doesn't exist/i),
    ).toBeInTheDocument();
  });

  it("renderiza botão 'Go Home'", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /Go Home/i }),
    ).toBeInTheDocument();
  });
});
