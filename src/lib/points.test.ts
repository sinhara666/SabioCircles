import { describe, it, expect } from "vitest";
import { levelForPoints, pointsToNextLevel, LEVEL_THRESHOLDS } from "./points";

describe("levelForPoints", () => {
  it("starts everyone at level 1 with zero points", () => {
    expect(levelForPoints(0)).toBe(1);
  });

  it("advances at each threshold, not before", () => {
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      const threshold = LEVEL_THRESHOLDS[i];
      expect(levelForPoints(threshold - 1)).toBe(i); // just under -> previous level
      expect(levelForPoints(threshold)).toBe(i + 1); // exactly at -> new level
    }
  });

  it("caps at the max level for very high point totals", () => {
    expect(levelForPoints(1_000_000)).toBe(LEVEL_THRESHOLDS.length);
  });

  it("never returns a level below 1 for negative/odd input", () => {
    expect(levelForPoints(-5)).toBe(1);
  });
});

describe("pointsToNextLevel", () => {
  it("reports points remaining to the next threshold", () => {
    const { next, remaining } = pointsToNextLevel(0);
    expect(next).toBe(2);
    expect(remaining).toBe(LEVEL_THRESHOLDS[1]);
  });

  it("returns null next level once max level is reached", () => {
    const { next, remaining } = pointsToNextLevel(1_000_000);
    expect(next).toBeNull();
    expect(remaining).toBe(0);
  });
});
