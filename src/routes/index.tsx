import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: DeprecationScreen,
});

function DeprecationScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-center">
      <h1 className="text-2xl font-semibold text-white">
        Projeto Desativado - Painel Migrado
      </h1>
    </div>
  );
}
