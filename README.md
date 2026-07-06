# Visualização da Câmara dos Deputados

Análise dos dados das Câmaras dos deputados, sendo detalhado diversos eixos, tanto por deputados, por partidos, etc.

O frontend é uma aplicação React/Vite totalmente estática. Em produção, todos os
resultados analíticos são lidos de arquivos JSON em `public/data`.

## Estrutura dos dados

```text
public/data/
  metadata.json
  questao-1.json
  questao-4.json
  questao-5.json
  questao-7.json
  questao-9.json
  questao-10.json
  deputados/
    {id}.json
  votos/
    {id}.json
```

Os dados gerais ficam consolidados. Detalhes e históricos de votação são
divididos por deputado para que o navegador baixe somente o arquivo aberto
pelo usuário.

## Atualizar o snapshot

O exportador deve ser executado localmente com o PostgreSQL do projeto
carregado:

```powershell
npm install
npm run export:data
```

Configuração padrão da conexão:

| Variável | Padrão |
|---|---|
| `PGHOST` | `localhost` |
| `PGPORT` | `5433` |
| `PGDATABASE` | `camara_db` |
| `PGUSER` | `camara_user` |
| `PGPASSWORD` | `camara_pass` |

O comando recria `public/data`, exporta os resultados de todas as questões e
atualiza `metadata.json`. Depois disso, o banco pode ser desligado: os arquivos
gerados são autossuficientes.

## Desenvolvimento e validação

```powershell
npm run dev
npm run lint
npm run typecheck:data
npm run build
npm run preview
```

Para confirmar que a versão é realmente estática, desligue o PostgreSQL e rode
`npm run preview`. Todas as visualizações e filtros devem continuar funcionando.

## Deploy no Vercel

Configure o projeto do Vercel com:

- Root Directory: `front_end`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

O arquivo `vercel.json` já registra essas opções e configura cache de CDN para
os JSONs. Os arquivos em `public/data` precisam estar versionados no repositório
antes do deploy.

## Atualizações futuras

Quando a API da Câmara disponibilizar dados de um novo período:

1. atualize o banco local;
2. execute `npm run export:data`;
3. revise o novo `metadata.json`;
4. faça commit dos JSONs;
5. publique um novo deploy.
