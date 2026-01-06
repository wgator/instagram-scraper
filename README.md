# Instagram Scraper

Scraper para coleta de posts públicos do Instagram via API GraphQL.

## Features

- **Login automático** via Puppeteer com cache de sessão (24h)
- **Cursor sintético** para pular direto para data desejada (~91% economia de requests)
- **Rate limiting inteligente** - considera tempo de resposta, não apenas intervalo fixo
- **Retry com backoff** para 401/429/5xx (15s de espera, 3 tentativas)
- **AsyncIterator** para streaming de posts com backpressure natural
- **Filtro de período** via parâmetros `since` e `until`

## Instalação

```bash
npm install
```

## Configuração

Crie um arquivo `.env` com as credenciais:

```bash
cp .env.example .env
```

```env
INSTAGRAM_USERNAME=seu_usuario
INSTAGRAM_PASSWORD=sua_senha
```

## Uso

### API

```javascript
import InstagramScraper from '@scrapers/instagram'

// Criar scraper com sessão cacheada (recomendado)
const scraper = await InstagramScraper.createWithSession()

// Coletar posts de um período
for await (const post of scraper.collect({
  username: 'instagram',
  userId: '25025320',
  since: '2022-01-01',
  until: '2022-12-31'
})) {
  console.log(post)
}
```

### Testes

```bash
# Testar autenticação
npm run test:auth

# Forçar novo login (ignora cache)
npm run test:auth:force

# Teste end-to-end
npm run test:e2e
```

## Arquitetura

```
src/
├── index.js      # Entry point + classe InstagramScraper
├── auth.js       # Login via Puppeteer + cache de sessão
├── session.js    # Extração de tokens do HTML
├── client.js     # HTTP client + rate limiting + retry
├── cursor.js     # Manipulação de cursores Snowflake
└── parser.js     # Mapeia response → formato padrão
```

## Formato de Output

```javascript
{
  post_id: '3473844133775926342',
  source: 'instagram',
  origin: 'scraper',
  posted_at: '2024-07-28T15:30:00.000Z',
  post_type: 'image' | 'video' | 'carousel' | 'reel',
  author_id: '1187782648',
  author_username: 'exemplo',
  author_name: 'Nome Completo',
  author_verified: false,
  content: 'Caption do post...',
  url: 'https://www.instagram.com/p/ABC123/',
  media_url: 'https://...',
  likes_count: 1500,
  comments_count: 42,
  views_count: 0,
  engagement: 1542,
  source_data: {
    code: 'ABC123',
    hashtags: [],
    mentions: [],
    is_paid_partnership: false
  }
}
```

## Rate Limiting

- **Ciclo padrão:** 4s por request (~900 req/hora)
- O tempo é calculado considerando a duração da request, não apenas o intervalo entre elas
- Em caso de 401/429, aguarda 15s e tenta novamente (até 3x)

## Cursor Sintético

O Instagram usa IDs no formato Snowflake com timestamp embutido. Isso permite criar um cursor sintético para pular diretamente para uma data específica, economizando ~91% dos requests em coletas de períodos passados.

```javascript
// Internamente, o scraper faz:
const cursor = `${timestampToPostId(untilDate)}_${userId}`
// E começa a paginação a partir desse ponto
```

## Licença

MIT
