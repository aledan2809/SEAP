import { AIRouter, getProjectPreset } from "ai-router";

const preset = getProjectPreset("SEAP");

export const aiRouter = new AIRouter({
  ...preset,
  projectName: "SEAP",
});

export { aiRouter as router };
