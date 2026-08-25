import { describe, expect, it } from "vitest";
import { selectRepositoryBranch } from "./chatRepository";

describe("selectRepositoryBranch", () => {
  it("uses an explicit valid branch and otherwise selects the repository default", () => {
    expect(selectRepositoryBranch(["main", "staging"], "staging", "main")).toBe("staging");
    expect(selectRepositoryBranch(["main", "staging"], "missing", "main")).toBe("main");
  });
});
