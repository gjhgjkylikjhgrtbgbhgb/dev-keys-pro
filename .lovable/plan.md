# Plano de Implementação: Sistema de Revendedores e Administração Hierárquica

Este plano descreve as alterações para implementar a hierarquia de administradores, gestão de revendedores com créditos, bloqueios e a remoção da landing page pública.

## Alterações de Banco de Dados (Supabase)

1.  **Novas Colunas na Tabela `profiles`**:
    *   `is_admin` (boolean, default false): Para identificar Sub-Admins.
    *   `support_whatsapp` (text): Para exibir contato de suporte aos revendedores.
    *   `last_seen` (timestamp): Para rastrear o último acesso.
    *   `is_blocked` (boolean, default false): Para controle de acesso.
    *   `credits` (int, default 0): Renomear ou usar `license_inventory` existente.

2.  **Ajustes na Tabela `licenses`**:
    *   Garantir `owner_id` (uuid) apontando para o revendedor.
    *   RLS: Garantir que revendedores vejam apenas suas licenças e admins vejam tudo.

## Backend (Server Functions)

1.  **Gestão de Usuários**:
    *   `promoteToAdmin`: Função para alternar `is_admin`.
    *   `toggleBlock`: Função para alternar `is_blocked`.
    *   `updateSupportWhatsapp`: Para definir o número de suporte.
    *   `deleteExhaustedLicenses`: Função para revendedores removerem licenças com `uses_remaining == 0`.

2.  **Autenticação e Roteamento**:
    *   Atualizar o `loader` da rota `/` para redirecionar conforme o estado de autenticação e role.
    *   Middleware para verificar `is_blocked` em todas as rotas protegidas.

## Frontend (Dashboard e Login)

1.  **Redirecionamento Raiz**: Remover `LandingPage` de `src/routes/index.tsx` e implementar redirecionamento automático.
2.  **Painel Admin (Master/Sub-Admin)**:
    *   Nova coluna de ações na lista de revendedores: "Tornar Admin", "Adicionar Créditos", "Bloquear".
    *   Exibição de `last_seen` e contador de licenças [Usadas/Total].
3.  **Painel do Revendedor**:
    *   Interface simplificada focada em "Minhas Licenças" e saldo de créditos.
    *   Alerta central "Renove seus créditos" se saldo for zero.
    *   Botão flutuante de WhatsApp de suporte se bloqueado.

## Detalhes Técnicos
- Utilização de `supabaseAdmin` para operações sensíveis.
- Manutenção do endpoint `/api/public/activate` intacto.
- Atualização do `localStorage` no login para persistência da role.
