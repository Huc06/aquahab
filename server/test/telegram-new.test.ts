import { describe, expect, it } from "vitest";
import { parseNewRoom } from "../src/telegram.ts";

describe("/new room syntax", () => {
  it("name only", () => {
    expect(parseNewRoom("Aquahab")).toEqual({ name: "Aquahab", goal: undefined, briefAt: undefined, debriefAt: undefined, private: false });
  });

  it("name, goal and both times", () => {
    expect(parseNewRoom("Aquahab | ship the demo by Nov 10 | 07:45 20:30")).toMatchObject({
      name: "Aquahab",
      goal: "ship the demo by Nov 10",
      briefAt: "07:45",
      debriefAt: "20:30",
    });
  });

  it("name and times without a goal", () => {
    expect(parseNewRoom("Aquahab | 07:45")).toMatchObject({ name: "Aquahab", goal: undefined, briefAt: "07:45", debriefAt: undefined });
  });

  it("a goal that contains a pipe keeps its parts", () => {
    expect(parseNewRoom("Aquahab | web | bot | 08:00 21:00").goal).toBe("web | bot");
  });

  it("private is read anywhere and removed from the name", () => {
    expect(parseNewRoom("private Client work | keep it quiet")).toMatchObject({ name: "Client work", goal: "keep it quiet", private: true });
  });
});
