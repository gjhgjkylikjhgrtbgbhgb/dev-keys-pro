# Plano de Correção e Melhoria do Dashboard de Revendedores

O objetivo é corrigir bugs de renderização mobile, melhorar a UX da gestão de revendedores e garantir a integridade dos dados, mantendo os endpoints de ativação intactos.

## Alterações Técnicas

### 1. Visual e UX (Mobile First)
- **Modal de Cadastro**: Mover o formulário de "Novo Revendedor" para um `Dialog` (Modal) responsivo, acionado por um botão "+ Novo Revendedor" no topo da aba.
- **Tabelas Responsivas**:
  - Desktop: Manter tabelas com `min-width` e scroll horizontal.
  - Mobile: Implementar visualização em **Cards** para revendedores quando a tela for menor que 768px, garantindo que todas as ações e dados caibam sem truncamento.
- **Formulário**: Garantir limpeza dos campos e fechamento automático do modal após sucesso.

### 2. Gestão de Revendedores (Dados)
- **Filtragem**: Ajustar a query no servidor (`getResellers`) para garantir que o Master Admin (11921009176) nunca apareça na lista de revendedores.
- **Refetch**: Garantir que o contador de revendedores e a lista atualizem imediatamente após qualquer ação (cadastro, bloqueio, transferência).
- **Tratamento de Erros**: Adicionar validação explícita para telefone duplicado com `toast` amigável.

### 3. Ações por Revendedor
- **Cards Mobile**: Cada card incluirá:
  - Nome e Telefone.
  - Saldo de Créditos.
  - Botão "Adicionar Créditos" (Modal).
  - Botão "Chamar no WhatsApp" (Link direto).
  - Botão "Bloquear/Desbloquear".
  - Botão "Excluir" (com confirmação).

### 4. Integridade
- **Endpoints**: O endpoint `/api/public/activate` não será alterado.
- **Autenticação**: A lógica de login do Master Admin permanece intacta.

## Componentes Utilizados
- `Dialog` do shadcn/ui para modais.
- `Card` e `Button` do shadcn/ui para layout mobile.
- `Table` do shadcn/ui para desktop.
- `Lucide React` para ícones.
