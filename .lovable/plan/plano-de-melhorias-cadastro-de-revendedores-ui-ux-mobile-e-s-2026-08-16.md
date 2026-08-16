# Plano de Melhorias: Cadastro de Revendedores, UI/UX Mobile e Segurança Visual

Este plano visa corrigir falhas no cadastro de revendedores, otimizar a experiência mobile com Dark Theme e adicionar recursos de usabilidade e segurança visual, mantendo a integridade dos endpoints de ativação.

## 1. Correção do Cadastro de Revendedores
- **Sanitização e Validação:** Ajustar a função `createReseller` no servidor para validar campos obrigatórios e tratar duplicidade de telefone/email de forma amigável.
- **Fluxo do Modal:** Melhorar o tratamento de erro no frontend (`DashboardPage`), garantindo que o modal feche apenas em caso de sucesso e que a lista de revendedores seja atualizada instantaneamente via `refetch`.
- **Feedback:** Implementar `toast.success` e `toast.error` com mensagens claras vindas do servidor.

## 2. Ajustes UI/UX Mobile (Dark Theme)
- **Responsividade:**
  - Adaptar containers e cards para telas pequenas usando classes utilitárias do Tailwind (`max-w-full`, `p-4`).
  - Implementar `overflow-x-auto` em todas as tabelas para garantir navegação lateral em dispositivos móveis.
  - Ajustar modais para que ocupem até 95% da largura da tela e permitam rolagem quando o teclado estiver aberto.
- **Tema Visual:** Refinar o Dark Theme com paleta (#0F172A / #1E293B) e tipografia clara (#F8FAFC) em todos os componentes.

## 3. Recursos de Usabilidade no Modal
- **Gerenciamento de Senha:**
  - Adicionar botão "Gerar Senha Aleatória" no formulário de cadastro (8-10 caracteres alfanuméricos).
  - Adicionar botão "Copiar Senha" com feedback de "Copiado!" usando a API `navigator.clipboard`.

## 4. Segurança Visual no Login
- **Visibilidade de Senha:** Implementar toggle (ícone de olho) no campo de senha da tela de login (`/auth`) para permitir que o usuário verifique o que digitou.

## Detalhes Técnicos
- **Frontend:** React + Tailwind CSS + Lucide Icons + Shadcn UI.
- **Backend:** TanStack Start Server Functions + Supabase Admin SDK (para criação de usuários).
- **Mobile First:** Uso intensivo de `flex-col`, `w-full` e `overflow-x-auto`.
