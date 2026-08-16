# License Gateway

Crie do zero uma aplicação completa com Supabase e painel administrativo Dark Theme moderno para gestão e ativação de licenças via API pública para aplicativo Android/TV Box, seguindo exatamente os requisitos abaixo:

1. BANCO DE DADOS SUPABASE:
- Crie a tabela licenses com os seguintes campos:
- id (uuid, chave primária, default gen_random_uuid())
- key (text, 6 dígitos numéricos únicos, indexado)
- filename (text, nome original do arquivo)
- content (text, conteúdo bruto original do arquivo de configuração)
- uses_remaining (int, default 3)
- status (text, default 'active')
- created_at (timestamp with time zone, default now())
- Configure as políticas de RLS (Row Level Security) para permitir leitura/atualização pública via API de ativação e controle total autenticado no painel.

2. PAINEL ADMIN (DARK THEME / VISUAL MODERNO):
- SEM VALORES FIXOS/MOCK: O contador de licenças/créditos deve ser 100% dinâmico baseado em SELECT count(*) ou no tamanho real da lista retornada do Supabase (elimine qualquer número fixo como 999).
- UPLOAD EM LOTE AUTOMÁTICO:
- Apenas uma área de Dropzone/Upload de arquivos (formatos .txt, .config).
- Aceita múltiplos arquivos de uma só vez (atributo multiple).
- NÃO coloque campos de texto solto/textarea nem seleção manual de usuário no upload.
- Ao clicar em "Processar e Gerar Licenças":
- O sistema lê o conteúdo bruto de cada arquivo enviado.
- Gera uma chave exclusiva de 6 dígitos numéricos para cada configuração.
- Faz o INSERT de cada registro diretamente no banco Supabase (filename, content, key, uses_remaining = 3).
- Atualiza a lista na tela instantaneamente em tempo real.
- LISTA DE LICENÇAS NO PAINEL:
- Tabela organizada e visível contendo: [Chave de 6 Dígitos] | [Nome do Arquivo] | [Tentativas Restantes (ex: 3/3, 2/3, 1/3, 0/3)] | [Status Ativo/Esgotado] | [Data de Criação].
- Botão para copiar a chave de 6 dígitos com um clique.

3. ENDPOINT / EDGE FUNCTION DE ATIVAÇÃO PÚBLICA (/api/public/activate ou Supabase Edge Function activate):
- Método: POST
- Payload esperado: { "key": "123456" }
- Regra de Negócio:
- Procura a licença pela chave de 6 dígitos onde status = 'active' e uses_remaining > 0.
- Se não encontrar ou uses_remaining <= 0, retorna HTTP 400/404 com erro de licença inválida ou esgotada.
- Se válida:
- Subtrai 1 de uses_remaining. Se chegar a 0, atualiza status = 'exhausted'.
- Retorna DIRETAMENTE o conteúdo bruto do arquivo original (content) no corpo da resposta (Content-Type: text/plain ou application/octet-stream), sem encapsular em JSON ou adicionar tags extras, permitindo que o app Flutter/Android salve e renomeie o arquivo diretamente no caminho /storage/emulated/0/Android/.config.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dev-keys-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9024c1c1-db52-4d4f-8e61-e3757ea2977c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
