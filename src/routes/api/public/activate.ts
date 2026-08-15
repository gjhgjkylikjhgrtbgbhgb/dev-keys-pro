import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/api/public/activate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { key } = z.object({ key: z.string().length(6) }).parse(body)

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server")

          // 1. Buscar a licença
          const { data: license, error: fetchError } = await supabaseAdmin
            .from('licenses')
            .select('*')
            .eq('key', key)
            .eq('status', 'active')
            .gt('uses_remaining', 0)
            .single()

          if (fetchError || !license) {
            return new Response(JSON.stringify({ error: 'Licença inválida ou esgotada' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // 2. Atualizar usos
          const newUses = license.uses_remaining - 1
          const newStatus = newUses === 0 ? 'exhausted' : 'active'

          const { error: updateError } = await supabaseAdmin
            .from('licenses')
            .update({
              uses_remaining: newUses,
              status: newStatus
            })
            .eq('id', license.id)

          if (updateError) {
            throw updateError
          }

          // 3. Retornar conteúdo bruto
          return new Response(license.content, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Disposition': `attachment; filename="${license.filename}"`
            }
          })

        } catch (err) {
          console.error('Activation error:', err)
          return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
