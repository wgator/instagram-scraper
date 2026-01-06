// src/parser.js
// Parser de posts do Instagram para formato padrão

/**
 * Determina tipo do post baseado em media_type e product_type
 * media_type: 1=image, 2=video, 8=carousel
 * product_type: feed, carousel_container, clips (reels)
 */
function getPostType(node) {
  if (node.media_type === 8) return 'carousel'
  if (node.media_type === 2) {
    return node.product_type === 'clips' ? 'reel' : 'video'
  }
  return 'image'
}

/**
 * Extrai URL da melhor imagem disponível
 */
function getBestImageUrl(node) {
  const candidates = node.image_versions2?.candidates
  if (!candidates?.length) return null
  
  // Primeira candidate geralmente é a maior
  return candidates[0]?.url || null
}

/**
 * Extrai URL do vídeo se disponível
 */
function getVideoUrl(node) {
  const versions = node.video_versions
  if (!versions?.length) return null
  
  return versions[0]?.url || null
}

/**
 * Extrai hashtags do caption
 */
function extractHashtags(caption) {
  if (!caption) return []
  const matches = caption.match(/#[\w\u00C0-\u024F]+/g)
  return matches || []
}

/**
 * Extrai mentions do caption
 */
function extractMentions(caption) {
  if (!caption) return []
  const matches = caption.match(/@[\w.]+/g)
  return matches?.map(m => m.slice(1)) || []
}

/**
 * Mapeia um node do GraphQL para formato padrão
 * @param {Object} node - Node do edges[]
 * @returns {Object} Post no formato padrão
 */
export function parsePost(node) {
  const caption = node.caption?.text || ''
  const postType = getPostType(node)
  const takenAt = node.taken_at ? new Date(node.taken_at * 1000) : null
  
  return {
    // Identificação
    post_id: node.pk,
    source: 'instagram',
    origin: 'scraper',
    posted_at: takenAt?.toISOString() || null,
    
    // Tipo
    post_type: postType,
    
    // Autor
    author_id: node.user?.pk || null,
    author_username: node.user?.username || null,
    author_name: node.user?.full_name || null,
    author_verified: node.user?.is_verified || false,
    
    // Conteúdo
    content: caption,
    url: `https://www.instagram.com/p/${node.code}/`,
    media_url: getVideoUrl(node) || getBestImageUrl(node),
    
    // Métricas
    likes_count: node.like_count || 0,
    comments_count: node.comment_count || 0,
    views_count: node.view_count || 0,
    engagement: (node.like_count || 0) + (node.comment_count || 0),
    
    // Dados extras
    source_data: {
      code: node.code,
      media_type: node.media_type,
      product_type: node.product_type,
      hashtags: extractHashtags(caption),
      mentions: extractMentions(caption),
      is_paid_partnership: node.is_paid_partnership || false,
      carousel_media_count: node.carousel_media_count || null,
      accessibility_caption: node.accessibility_caption || null
    }
  }
}

/**
 * Parseia array de edges para posts
 * @param {Array} edges - Array de edges do GraphQL
 * @returns {Array} Posts parseados
 */
export function parsePosts(edges) {
  return edges
    .map(edge => edge.node)
    .filter(node => node && node.pk)
    .map(parsePost)
}

export default {
  parsePost,
  parsePosts
}
