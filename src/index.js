// src/index.js
// Instagram Scraper - Entry point

import { createSession, loadSessionTokens, resolveUserId } from './session.js'
import { fetchPosts, extractData, MAX_COUNT, DEFAULT_CYCLE_MS } from './client.js'

const sleep = ms => new Promise(r => setTimeout(r, ms))
import { parsePosts } from './parser.js'
import { createCursor, postIdToTimestamp } from './cursor.js'
import { login, loginFromEnv, getSession } from './auth.js'

export { createSession, loadSessionTokens, resolveUserId } from './session.js'
export { createCursor, postIdToTimestamp, timestampToPostId } from './cursor.js'
export { parsePost, parsePosts } from './parser.js'
export { login, loginFromEnv, getSession, saveSession, loadSession } from './auth.js'

/**
 * Instagram Profile Scraper
 * 
 * Coleta posts de um perfil público usando a API GraphQL do Instagram.
 * Suporta cursor sintético para pular diretamente para uma data específica.
 */
export class InstagramScraper {
  constructor(session) {
    if (!session.fb_dtsg) {
      throw new Error('Sessão não tem tokens carregados. Use loadSessionTokens() primeiro.')
    }
    this.session = session
  }
  
  /**
   * Cria scraper a partir de cookies
   * @param {Object} cookies - { sessionid, csrftoken, ds_user_id }
   * @returns {Promise<InstagramScraper>}
   */
  static async create(cookies) {
    const session = createSession(cookies)
    await loadSessionTokens(session)
    return new InstagramScraper(session)
  }

  /**
   * Cria scraper fazendo login automático
   * @param {Object} credentials - { username, password }
   * @param {Object} loginOptions - Opções para o login (headless, timeout, etc)
   * @returns {Promise<InstagramScraper>}
   */
  static async createWithLogin(credentials, loginOptions = {}) {
    const cookies = await login(credentials, loginOptions)
    return InstagramScraper.create(cookies)
  }

  /**
   * Cria scraper usando credenciais do ambiente (.env)
   * @param {Object} loginOptions - Opções para o login
   * @returns {Promise<InstagramScraper>}
   */
  static async createFromEnv(loginOptions = {}) {
    const cookies = await loginFromEnv(loginOptions)
    return InstagramScraper.create(cookies)
  }

  /**
   * Cria scraper com sessão cacheada (recomendado)
   * Carrega sessão do arquivo se válida, senão faz login
   * @param {Object} options
   * @param {boolean} options.forceLogin - Forçar novo login
   * @param {string} options.sessionFile - Caminho do arquivo de sessão
   * @param {number} options.maxAgeHours - Idade máxima da sessão em horas
   * @param {Object} options.loginOptions - Opções para o login
   * @returns {Promise<InstagramScraper>}
   */
  static async createWithSession(options = {}) {
    const cookies = await getSession(options)
    return InstagramScraper.create(cookies)
  }
  
  /**
   * Coleta posts de um perfil
   * 
   * @param {Object} options
   * @param {string} options.username - Username do perfil (sem @)
   * @param {string} options.userId - ID numérico do usuário (obrigatório para cursor sintético)
   * @param {string|Date} options.since - Data mínima (quando parar)
   * @param {string|Date} options.until - Data máxima (quando começar a emitir)
   * @param {number} options.cycleMs - Tempo mínimo por ciclo em ms (default: 4000 para ~900 req/h)
   * @param {Function} options.onProgress - Callback de progresso (opcional)
   * @yields {Object} Posts no formato padrão
   */
  async *collect({ username, userId, since, until, cycleMs = DEFAULT_CYCLE_MS, onProgress }) {
    // Validações
    if (!username) throw new Error('username é obrigatório')
    if (!userId) throw new Error('userId é obrigatório para cursor sintético')
    
    const sinceDate = since ? new Date(since) : null
    const untilDate = until ? new Date(until) : new Date()
    
    // Cria cursor sintético para começar na data 'until'
    let cursor = createCursor(untilDate, userId)
    let hasNextPage = true
    let totalCollected = 0
    let requestCount = 0
    
    while (hasNextPage) {
      const cycleStart = Date.now()
      requestCount++
      
      // Faz request
      const response = await fetchPosts(this.session, {
        username,
        cursor,
        count: MAX_COUNT
      })
      
      const { edges, pageInfo } = extractData(response)
      
      if (!edges.length) {
        break
      }
      
      // Parseia posts
      const posts = parsePosts(edges)
      
      for (const post of posts) {
        const postDate = new Date(post.posted_at)
        
        // Se post é mais antigo que 'since', para
        if (sinceDate && postDate < sinceDate) {
          hasNextPage = false
          break
        }
        
        // Só emite se está dentro do range
        if (postDate <= untilDate) {
          totalCollected++
          yield post
        }
      }
      
      // Callback de progresso
      if (onProgress) {
        const oldestPost = posts[posts.length - 1]
        onProgress({
          requestCount,
          totalCollected,
          oldestDate: oldestPost?.posted_at,
          hasNextPage: pageInfo.has_next_page
        })
      }
      
      // Próxima página
      hasNextPage = pageInfo.has_next_page && hasNextPage
      cursor = pageInfo.end_cursor
      
      if (!cursor) {
        break
      }
      
      // Rate limiting: aguarda se o ciclo foi mais rápido que o mínimo
      if (cycleMs > 0 && hasNextPage) {
        const elapsed = Date.now() - cycleStart
        const remaining = cycleMs - elapsed
        if (remaining > 0) {
          await sleep(remaining)
        }
      }
    }
  }
  
  /**
   * Coleta todos os posts e retorna como array
   * (wrapper conveniente sobre collect)
   */
  async collectAll(options) {
    const posts = []
    for await (const post of this.collect(options)) {
      posts.push(post)
    }
    return posts
  }
}

export default InstagramScraper
