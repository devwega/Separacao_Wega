import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (className merger)", () => {
  it("concatena classes simples", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("ignora valores falsy", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("aceita objetos do clsx", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("faz merge correto de utilitários Tailwind conflitantes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm text-foreground", "text-lg")).toBe("text-foreground text-lg");
  });

  it("preserva classes não conflitantes", () => {
    const result = cn("flex items-center", "gap-2", "rounded-md");
    expect(result).toContain("flex");
    expect(result).toContain("items-center");
    expect(result).toContain("gap-2");
    expect(result).toContain("rounded-md");
  });
});
