import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle (002-dark-mode / T-02)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("permite alternar entre Claro, Escuro e Sistema via clique e teclado", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const lightBtn = screen.getByRole("button", { name: "Tema Claro" });
    const darkBtn = screen.getByRole("button", { name: "Tema Escuro" });
    const systemBtn = screen.getByRole("button", { name: "Tema Sistema" });

    expect(systemBtn).toHaveAttribute("aria-pressed", "true");

    await user.click(darkBtn);
    expect(darkBtn).toHaveAttribute("aria-pressed", "true");
    expect(systemBtn).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    lightBtn.focus();
    await user.keyboard("{Enter}");
    expect(lightBtn).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    systemBtn.focus();
    await user.keyboard(" ");
    expect(systemBtn).toHaveAttribute("aria-pressed", "true");
  });
});
