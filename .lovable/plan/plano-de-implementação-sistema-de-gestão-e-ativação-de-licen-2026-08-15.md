# Plano de Implementação - Sistema de Gestão e Ativação de Licenças

Este projeto consiste em um sistema de gerenciamento de licenças para aplicativos Android/TV Box, com um painel administrativo moderno em Dark Theme e uma API pública para ativação.

## Banco de Dados (Supabase)

1.  **Tabela `public.licenses`**:
    *   `id`: UUID (Primary Key).
    *   `key`: TEXT (6 dígitos numéricos únicos, indexado).
    *   `filename`: TEXT (Nome original do arquivo).
    *   `content`: TEXT (Conteúdo bruto do arquivo).
    *   `uses_remaining`: INT (Padrão 3).
    *   `status`: TEXT (Padrão 'active').
    *   `created_at`: TIMESTAMPTZ (Padrão now()).
2.  **Segurança (RLS)**:
    *   Políticas para permitir que a API pública leia e atualize o contador de usos.
    *   Políticas de controle total para usuários autenticados (Admin).
    *   Grants necessários para `anon`, `authenticated` e `service_role`.

## Painel Administrativo (Frontend)

*   **Tema**: Dark Theme moderno usando Tailwind CSS e componentes shadcn/ui.
*   **Dashboard**:
    *   Contador dinâmico de licenças totais e ativas.
    *   Área de Dropzone para upload de múltiplos arquivos `.txt` e `.config`.
*   **Funcionalidade de Upload**:
    *   Leitura do conteúdo dos arquivos no lado do cliente.
    *   Geração de chaves numéricas de 6 dígitos.
    *   Inserção em lote no Supabase.
*   **Lista de Licenças**:
    *   Tabela com: Chave, Nome do Arquivo, Usos (x/3), Status e Data.
    *   Botão "Copiar Chave".

## API de Ativação (Backend)

*   **Endpoint**: `/api/public/activate` (POST).
*   **Lógica**:
    1.  Validar a chave recebida.
    2.  Verificar se a licença está ativa e possui usos restantes.
    3.  Decrementar `uses_remaining`.
    4.  Atualizar para `exhausted` se chegar a zero.
    5.  Retornar o conteúdo bruto (`text/plain`) para download direto pelo app Android.

## Detalhes Técnicos

*   **Framework**: TanStack Start (React 19).
*   **Estilização**: Tailwind CSS v4.
*   **API**: Server Routes do TanStack para o endpoint de ativação pública.
*   **Banco**: Supabase com RLS.
