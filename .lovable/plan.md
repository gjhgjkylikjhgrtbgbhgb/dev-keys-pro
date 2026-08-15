# Plano de Implementação: Sistema de Login Direto e Gestão de Revendedores

Este plano descreve as alterações para remover a autenticação OAuth (Google) em favor de um login direto por Telefone/Senha, além de implementar a gestão interna de revendedores acessível apenas pelo Administrador Master.

## 1. Autenticação Direta (Telefone/Senha)
- Substituir a página de login atual por um formulário de dois campos: Telefone/Usuário e Senha.
- Criar a conta Master Admin inicial via SQL migration (se ainda não existir).
- Ajustar as funções de servidor para validar as credenciais no Supabase.

## 2. Gestão de Revendedores
- Implementar interface no painel admin para:
    - Cadastrar novos revendedores (Nome, Telefone, Senha).
    - Listar revendedores ativos com indicadores de saldo de licenças.
    - Transferir licenças do estoque geral para um revendedor específico.
    - Bloquear/Desbloquear acesso de revendedores.
- Adicionar atalho "Chamar no WhatsApp" na lista de revendedores.

## 3. Segurança e Regras de Negócio
- Apenas o usuário com role `admin` (Master) terá acesso à aba de gestão de usuários.
- Revendedores verão apenas suas próprias licenças e seu saldo.
- O login será imediato, sem verificação de e-mail ou SMS, conforme solicitado.

## Detalhes Técnicos
- **Supabase**: Tabelas `profiles` e `user_roles` para gerenciar perfis e permissões.
- **Server Functions**: Novas funções para CRUD de revendedores e transferência de saldo.
- **UI**: Uso de componentes shadcn/ui em Dark Theme.
