// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

/**
 * TC1 — stands up the jsdom + @testing-library/react component-test
 * infrastructure (package.json + vitest.config.ts *.test.tsx include) with a
 * minimal smoke render. Every other *.test.tsx in this lane relies on this
 * pragma + dependency pairing actually working — if jsdom/RTL wiring
 * regresses, this is the first thing that goes red.
 */

afterEach(() => cleanup());

function Hello({ name }: { name: string }) {
  return <p>Hello, {name}!</p>;
}

describe("component-test infra (jsdom + @testing-library/react)", () => {
  it("renders a component into jsdom and queries it via screen", () => {
    render(<Hello name="Calling Queue" />);
    expect(screen.getByText("Hello, Calling Queue!")).toBeTruthy();
  });

  it("has a real DOM (window/document) available — proves the jsdom environment pragma took effect", () => {
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");
    expect(document.body).toBeTruthy();
  });
});
