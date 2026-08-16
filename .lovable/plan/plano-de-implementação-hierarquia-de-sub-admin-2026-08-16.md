# Plano de Implementação: Hierarquia de Sub-Admin

Implementação de uma hierarquia de Sub-Admin para gestão de revendedores e transferência de créditos, com restrições de visualização e lógica de saldo, mantendo a integridade dos endpoints de ativação.

## Alterações no Banco de Dados (Supabase)

- **Schema `profiles`**: Adição da coluna `parent_id` (UUID) referenciando `profiles(id)` para rastrear quem cadastrou quem.
- **Função de Transferência**: Criação da RPC `transfer_credits_safe` com `SECURITY DEFINER` para garantir transferências atômicas e validação de saldo no servidor.

## Funções de Servidor (`src/lib/licenses.functions.ts`)

- **`getResellers`**: Atualizar para filtrar por `parent_id` caso o usuário não seja Master Admin.
- **`createReseller`**: Atualizar para incluir automaticamente o `parent_id` do usuário logado se ele for Sub-Admin.
- **`transferLicenses`**: Integrar a nova lógica de validação de saldo (verificar se o Sub-Admin tem saldo antes de transferir).
- **`getLicenseStats`**: Ocultar estatísticas globais para Sub-Admins, mostrando apenas dados pertinentes.

## Interface do Usuário (`src/routes/_authenticated/dashboard.tsx`)

- **Restrição de Abas**: Ocultar abas "Licenças" (estoque geral) e "Gerar Licenças" para Sub-Admins. Sub-Admins veem apenas a gestão de seus próprios revendedores.
- **Filtros e Contadores**: Ajustar os cards de resumo para refletir o escopo do Sub-Admin (contagem de revendedores vinculados).
- **Ações Restritas**: Ocultar botões "Tornar Admin" para Sub-Admins; permitir apenas gestão básica (WhatsApp, Bloquear, Excluir, Créditos) de seus próprios revendedores.
- **Validação de UI**: Feedback instantâneo via Toast se o Sub-Admin tentar transferir mais créditos do que possui.

## Considerações de Segurança

- **Master Admin (11921009176)**: Privilégios mantidos intactos; visualização global permanece funcional.
- **RLS**: As políticas de banco de dados serão reforçadas para garantir que um Sub-Admin não consiga manipular perfis que não pertençam à sua árvore hierárquica.
