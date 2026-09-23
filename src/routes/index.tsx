import { createFileRoute } from "@tanstack/react-router";
import { SensusApp } from "@/components/sensus/SensusApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sensus — Voice-First Cognitive Clarity" },
      { name: "description", content: "Turn spoken reflections into grounded insight, clear actions, and reality-tested goals." },
      { property: "og:title", content: "Sensus — Voice-First Cognitive Clarity" },
      { property: "og:description", content: "Turn mental noise into grounded insight, clear actions, and a vision you can execute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SensusApp,
});
