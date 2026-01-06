# Instagram GraphQL API Reference

> Documentação reversa do endpoint de posts do perfil
> Capturado: 05/01/2025

---

## Endpoint

```
POST https://www.instagram.com/graphql/query
Content-Type: application/x-www-form-urlencoded
```

---

## Headers Obrigatórios

### Mínimos (testado)

```javascript
const headers = {
  'accept': '*/*',
  'accept-language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'content-type': 'application/x-www-form-urlencoded',
  'x-csrftoken': csrftoken  // Extrair do cookie 'csrftoken'
}
```

### Recomendados (credibilidade)

Para parecer mais com browser real, adicionar:

```javascript
const headers = {
  // Mínimos
  'accept': '*/*',
  'accept-language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'content-type': 'application/x-www-form-urlencoded',
  'x-csrftoken': csrftoken,
  
  // Credibilidade
  'x-ig-app-id': '936619743392459',
  'x-requested-with': 'XMLHttpRequest',
  'referer': `https://www.instagram.com/${username}/`,
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}
```

### Cookies Necessários

```
sessionid, csrftoken, ds_user_id
```

O `csrftoken` é extraído do cookie e enviado também no header `x-csrftoken` (mesmo valor).

**Nota:** Requer sessão logada para paginação funcionar.

---

## Body Parameters

### Fixos (podem mudar com updates do Instagram)

| Param | Valor | Notas |
|-------|-------|-------|
| `doc_id` | `25051715364499547` | **Query hash** - identifica a query GraphQL |
| `fb_api_req_friendly_name` | `PolarisProfilePostsTabContentQuery_connection` | |
| `server_timestamps` | `true` | |

### Dinâmicos

| Param | Descrição |
|-------|-----------|
| `fb_dtsg` | Token CSRF do Facebook (extrair do HTML) |
| `lsd` | Mesmo valor do header `x-fb-lsd` |
| `jazoest` | Token de validação (extrair do HTML) |
| `variables` | JSON com parâmetros da query (ver abaixo) |

---

## Variables (JSON)

```json
{
  "after": "3667331063574730547_1187782648",  // Cursor: {post_id}_{user_id}
  "before": null,
  "data": {
    "count": 33,                               // Máximo aceito: 33
    "include_reel_media_seen_timestamp": true,
    "include_relationship_info": true,
    "latest_besties_reel_media": true,
    "latest_reel_media": true
  },
  "first": 33,                                 // Deve ser igual a count
  "last": null,
  "username": "deputadomarcosmuller",
  "__relay_internal__pv__PolarisIsLoggedInrelayprovider": true
}
```

**Nota:** `count` e `first` máximo = 33. Valores maiores são ignorados ou causam erro.

### Primeira Request vs Paginação

**Primeira request (sem cursor):**
```json
{
  "data": { "count": 12, ... },
  "username": "deputadomarcosmuller",
  "__relay_internal__pv__PolarisIsLoggedInrelayprovider": true
}
```

**Com paginação (cursor sintético ou real):**
```json
{
  "after": "3667331063574730547_1187782648",
  "before": null,
  "first": 33,
  "last": null,
  "data": { "count": 33, ... },
  "username": "deputadomarcosmuller",
  "__relay_internal__pv__PolarisIsLoggedInrelayprovider": true
}
```

**Nota:** Com cursor sintético, pulamos direto para a data desejada — nunca usamos a primeira request "limpa".

### Cursor Sintético ✅ VALIDADO

O cursor `after` aceita IDs sintéticos baseados em timestamp:

```javascript
const INSTAGRAM_EPOCH = 1314220021721n  // ms (Set 2011)

// Timestamp → Post ID aproximado
function timestampToPostId(dateMs) {
  return (BigInt(dateMs) - INSTAGRAM_EPOCH) << 23n
}

// Post ID → Timestamp
function postIdToTimestamp(postId) {
  return Number((BigInt(postId) >> 23n) + INSTAGRAM_EPOCH)
}

// Exemplo: cursor para 2022-10-02
const targetDate = new Date('2022-10-02T00:00:00Z')
const syntheticPostId = timestampToPostId(targetDate.getTime())
const cursor = `${syntheticPostId}_${userId}`
// → "2941057392009666560_1187782648"
```

---

## Response Structure

```
data.xdt_api__v1__feed__user_timeline_graphql_connection.edges[]
```

### Post Object (node)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `pk` | string | Post ID numérico |
| `id` | string | `{post_id}_{user_id}` |
| `code` | string | Shortcode (usado na URL) |
| `taken_at` | number | Unix timestamp (segundos) |
| `caption.text` | string | Texto do post |
| `caption.created_at` | number | Timestamp da caption |
| `like_count` | number | Likes |
| `comment_count` | number | Comentários |
| `view_count` | number | Views (vídeos) |
| `media_type` | number | 1=image, 2=video, 8=carousel |
| `product_type` | string | `feed`, `carousel_container`, `clips` (reels) |

### User Object (user)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `pk` | string | User ID |
| `username` | string | Handle |
| `full_name` | string | Nome completo |
| `is_verified` | boolean | Verificado |
| `is_private` | boolean | Conta privada |

### Media

| Campo | Notas |
|-------|-------|
| `image_versions2.candidates[]` | Array de resoluções |
| `video_versions[]` | Versões do vídeo (se aplicável) |
| `carousel_media[]` | Items do carrossel (se `media_type=8`) |
| `carousel_media_count` | Quantidade de items |

### Pagination

Path completo: `data.xdt_api__v1__feed__user_timeline_graphql_connection.page_info`

```javascript
const connection = data.xdt_api__v1__feed__user_timeline_graphql_connection
const { has_next_page, end_cursor } = connection.page_info

// Loop de paginação
let cursor = initialSyntheticCursor
while (true) {
  const data = await fetchPosts({ username, after: cursor, count: 33 })
  const connection = data.xdt_api__v1__feed__user_timeline_graphql_connection
  
  yield* connection.edges.map(e => e.node)
  
  if (!connection.page_info.has_next_page) break
  cursor = connection.page_info.end_cursor
}
```

| Campo | Descrição |
|-------|-----------|
| `page_info.has_next_page` | Tem mais páginas |
| `page_info.end_cursor` | Cursor para próxima página |
| `edges[].cursor` | Cursor individual (geralmente vazio) |

---

## Media Types

| `media_type` | `product_type` | Descrição |
|--------------|----------------|-----------|
| 1 | `feed` | Imagem única |
| 2 | `feed` | Vídeo no feed |
| 2 | `clips` | Reel |
| 8 | `carousel_container` | Carrossel |

---

## Rate Limiting

| Condição | Limite Estimado |
|----------|-----------------|
| Sem sessão | ~200 req/hora |
| Com sessão válida | ~1000 req/hora |
| Com proxy rotativo | Depende do pool |

### Sinais de Rate Limit

- HTTP 429
- Response com `challenge_required`
- Response vazio ou truncado

---

## Tokens a Extrair do HTML

Todos os tokens vêm do elemento `#__eqmc` no HTML:

```javascript
// Carregar página do perfil
const html = await fetch('https://www.instagram.com/username/').then(r => r.text())

// Extrair JSON do elemento #__eqmc
const eqmcMatch = html.match(/<script id="__eqmc"[^>]*>(\{.*?\})<\/script>/)
const params = JSON.parse(eqmcMatch[1])

// Extrair tokens
const fb_dtsg = params.f    // Ex: "NAftTmldPqY....:17843691127146670:1751807068"
const lsd = params.l        // Pode ser null
const jazoest = params.u.match(/jazoest=(\d+)/)?.[1]  // Ex: "26342"
```

### Estrutura do `#__eqmc`

```json
{
  "u": "/ajax/qm/?__a=1&__user=0&__comet_req=7&jazoest=26342",
  "e": "7591991511214891681",
  "s": "XPolarisProfileController", 
  "w": 0,
  "f": "NAftTmldPqYOiSwqs2dDnSlfcIBa2MNdJDi6DH6GVvx3F5r-kBElgtg:17843691127146670:1751807068",
  "l": null
}
```

| Campo | Token | Notas |
|-------|-------|-------|
| `f` | `fb_dtsg` | Token CSRF principal |
| `l` | `lsd` | Pode ser null em algumas sessões |
| `u` | contém `jazoest` | Extrair com regex da URL |

---

## Exemplo de URL Construída

```
https://www.instagram.com/p/{code}/
```

Onde `code` é o shortcode do post (ex: `CjJSS94jFjD`).
