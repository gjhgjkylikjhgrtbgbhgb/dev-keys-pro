import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/activate")({
  server: {
    handlers: {
      GET: () =>
        new Response("Projeto Desativado - Painel Migrado", { status: 410 }),
      POST: () =>
        new Response("Projeto Desativado - Painel Migrado", { status: 410 }),
    },
  },
});
