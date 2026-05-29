import { test as base, type Page } from "@playwright/test";

export const ROUTES = {
  pedidos: { path: "/", label: "Pedidos Liberados", heading: /Pedidos Liberados para Separação/i },
  bipe: { path: "/bipe", label: "BIPE Separação", heading: /Bipagem do Item/i },
  divergencias: { path: "/divergencias", label: "Divergências e Trocas" },
  faltas: { path: "/faltas", label: "Faltas e Apanho" },
  fluxoDistinto: { path: "/fluxo-distinto", label: "Fluxo Distinto" },
  preFaturamento: { path: "/pre-faturamento", label: "Pré-Faturamento" },
  bipeMobile: { path: "/bipe-mobile", label: "BIPE Mobile" },
} as const;

export async function gotoRoute(page: Page, route: keyof typeof ROUTES) {
  await page.goto(ROUTES[route].path);
}

export const test = base.extend({});
export { expect } from "@playwright/test";
