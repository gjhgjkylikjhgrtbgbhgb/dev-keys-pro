import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { supabase } from "./integrations/supabase/client";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Middleware para anexar o token de autenticação do Supabase às chamadas de função de servidor
const authMiddleware = createMiddleware({ type: "function" }).client(async ({ next }: { next: any }) => {
  const { data: { session } } = await supabase.auth.getSession();
  return next({
    headers: session ? {
      Authorization: `Bearer ${session.access_token}`,
    } : {},
  });
});



export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
  functionMiddleware: [authMiddleware],
}));

