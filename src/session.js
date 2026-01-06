// src/session.js
// Gerenciamento de sessão e extração de tokens

import { request } from 'undici'

/**
 * Extrai tokens do HTML de uma página Instagram
 * @param {string} html - HTML da página
 * @returns {Object} Tokens extraídos
 */
export function extractTokensFromHtml(html) {
  // Extrair JSON do elemento #__eqmc
  const eqmcMatch = html.match(/<script[^>]*id="__eqmc"[^>]*>(\{.*?\})<\/script>/s)
  
  if (!eqmcMatch) {
    throw new Error('Elemento #__eqmc não encontrado no HTML')
  }
  
  const params = JSON.parse(eqmcMatch[1])
  
  const fb_dtsg = params.f
  const lsd = params.l
  const jazoest = params.u?.match(/jazoest=(\d+)/)?.[1]
  
  if (!fb_dtsg) {
    throw new Error('fb_dtsg não encontrado')
  }
  
  if (!jazoest) {
    throw new Error('jazoest não encontrado')
  }
  
  return { fb_dtsg, lsd, jazoest }
}

/**
 * Extrai user ID do HTML da página de perfil
 * @param {string} html - HTML da página
 * @returns {string|null} User ID
 */
export function extractUserIdFromHtml(html) {
  // Tenta extrair de diferentes lugares
  const patterns = [
    /"user_id":"(\d+)"/,
    /"profilePage_(\d+)"/,
    /\"id\":\"(\d+)\",\"username\"/
  ]
  
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1]
  }
  
  return null
}

/**
 * Parseia cookies de uma string Set-Cookie ou cookie header
 * @param {string|string[]} cookieHeader - Header(s) de cookie
 * @returns {Object} Objeto com cookies parseados
 */
export function parseCookies(cookieHeader) {
  const cookies = {}
  const cookieStr = Array.isArray(cookieHeader) 
    ? cookieHeader.join('; ') 
    : cookieHeader
  
  if (!cookieStr) return cookies
  
  const pairs = cookieStr.split(/;\s*/)
  for (const pair of pairs) {
    const [name, ...valueParts] = pair.split('=')
    if (name && valueParts.length) {
      // Ignora atributos como Path, Domain, etc
      if (!['path', 'domain', 'expires', 'max-age', 'secure', 'httponly', 'samesite'].includes(name.toLowerCase())) {
        cookies[name.trim()] = valueParts.join('=').trim()
      }
    }
  }
  
  return cookies
}

/**
 * Serializa cookies para header
 * @param {Object} cookies - Objeto com cookies
 * @returns {string} String formatada para header Cookie
 */
export function serializeCookies(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

/**
 * Carrega sessão a partir de cookies fornecidos
 * @param {Object} options
 * @param {string} options.sessionid - Cookie sessionid
 * @param {string} options.csrftoken - Cookie csrftoken  
 * @param {string} options.ds_user_id - Cookie ds_user_id
 * @returns {Object} Sessão pronta para uso
 */
export function createSession({ sessionid, csrftoken, ds_user_id }) {
  if (!sessionid || !csrftoken) {
    throw new Error('sessionid e csrftoken são obrigatórios')
  }
  
  return {
    cookies: { sessionid, csrftoken, ds_user_id },
    csrftoken,
    // Tokens dinâmicos serão preenchidos depois
    fb_dtsg: null,
    lsd: null,
    jazoest: null
  }
}

/**
 * Carrega tokens dinâmicos fazendo request para uma página
 * @param {Object} session - Sessão criada com createSession
 * @param {string} username - Username para carregar página de perfil
 * @returns {Object} Sessão atualizada com tokens
 */
export async function loadSessionTokens(session, username = 'instagram') {
  const url = `https://www.instagram.com/${username}/`
  
  const { body, headers } = await request(url, {
    headers: {
      'accept': 'text/html',
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'cookie': serializeCookies(session.cookies),
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })
  
  const html = await body.text()
  const tokens = extractTokensFromHtml(html)
  
  // Atualiza sessão com tokens
  session.fb_dtsg = tokens.fb_dtsg
  session.lsd = tokens.lsd
  session.jazoest = tokens.jazoest
  
  return session
}

/**
 * Resolve userId de um username fazendo request para página de perfil
 * @param {string} username - Username do perfil
 * @param {Object} session - Sessão com cookies
 * @returns {Promise<string>} User ID
 */
export async function resolveUserId(username, session) {
  const url = `https://www.instagram.com/${username}/`
  
  const { body } = await request(url, {
    headers: {
      'accept': 'text/html',
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'cookie': serializeCookies(session.cookies),
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })
  
  const html = await body.text()
  const userId = extractUserIdFromHtml(html)
  
  if (!userId) {
    throw new Error(`Não foi possível extrair userId de @${username}`)
  }
  
  return userId
}

export default {
  extractTokensFromHtml,
  extractUserIdFromHtml,
  parseCookies,
  serializeCookies,
  createSession,
  loadSessionTokens,
  resolveUserId
}
