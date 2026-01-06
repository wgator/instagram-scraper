// src/client.js
// HTTP client para GraphQL do Instagram

import { request } from 'undici'
import { serializeCookies } from './session.js'

const GRAPHQL_URL = 'https://www.instagram.com/graphql/query'
const DOC_ID = '25051715364499547'
export const MAX_COUNT = 33

// Rate limiting: 4s por ciclo para ~900 req/h
// O delay é calculado no caller (index.js) considerando tempo total do ciclo
const DEFAULT_CYCLE_MS = 4000

// Retry config
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 15000 // 15s para retry (401/429)

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * Cria o body da request GraphQL
 */
function buildRequestBody(session, variables) {
  const params = new URLSearchParams()
  
  params.set('fb_dtsg', session.fb_dtsg)
  params.set('jazoest', session.jazoest)
  if (session.lsd) params.set('lsd', session.lsd)
  params.set('variables', JSON.stringify(variables))
  params.set('doc_id', DOC_ID)
  
  return params.toString()
}

/**
 * Constrói as variables para a query
 */
function buildVariables({ username, cursor = null, count = MAX_COUNT }) {
  const variables = {
    data: {
      count: Math.min(count, MAX_COUNT),
      include_reel_media_seen_timestamp: true,
      include_relationship_info: true,
      latest_besties_reel_media: true,
      latest_reel_media: true
    },
    username,
    __relay_internal__pv__PolarisIsLoggedInrelayprovider: true
  }
  
  // Adiciona campos de paginação se tiver cursor
  if (cursor) {
    variables.after = cursor
    variables.before = null
    variables.first = Math.min(count, MAX_COUNT)
    variables.last = null
  }
  
  return variables
}

/**
 * Executa request HTTP (sem retry)
 */
async function doRequest(session, { username, cursor, count }) {
  const variables = buildVariables({ username, cursor, count })
  const body = buildRequestBody(session, variables)
  
  const headers = {
    'accept': '*/*',
    'accept-language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'content-type': 'application/x-www-form-urlencoded',
    'x-csrftoken': session.csrftoken,
    'x-ig-app-id': '936619743392459',
    'x-requested-with': 'XMLHttpRequest',
    'referer': `https://www.instagram.com/${username}/`,
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'cookie': serializeCookies(session.cookies)
  }
  
  const response = await request(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body
  })
  
  return response
}

/**
 * Faz request para o endpoint GraphQL com rate limiting e retry
 * @param {Object} session - Sessão com tokens
 * @param {Object} options
 * @param {string} options.username - Username do perfil
 * @param {string} options.cursor - Cursor para paginação
 * @param {number} options.count - Posts por página (max 33)
 * @param {number} options.delayMs - Delay entre requests (default: 4000)
 * @param {number} options.retries - Tentativas restantes (interno)
 * @returns {Object} Response parseado
 */
export async function fetchPosts(session, options) {
  const { 
    username, 
    cursor = null, 
    count = MAX_COUNT,
    retries = MAX_RETRIES
  } = options

  const response = await doRequest(session, { username, cursor, count })
  
  // 401: Rate limit temporário (não é sessão expirada!)
  // Instagram retorna 401 com "Please wait a few minutes"
  if (response.statusCode === 401) {
    if (retries > 0) {
      console.log(`   ⚠️ Rate limit (401). Aguardando ${RETRY_DELAY_MS/1000}s... (${retries} tentativas restantes)`)
      await sleep(RETRY_DELAY_MS)
      return fetchPosts(session, { ...options, retries: retries - 1 })
    }
    const error = new Error('Rate limit (401) após todas tentativas')
    error.code = 'RATE_LIMITED'
    error.statusCode = 401
    throw error
  }
  
  // 429: Rate limit explícito
  if (response.statusCode === 429) {
    if (retries > 0) {
      console.log(`   ⚠️ Rate limit (429). Aguardando ${RETRY_DELAY_MS/1000}s... (${retries} tentativas restantes)`)
      await sleep(RETRY_DELAY_MS)
      return fetchPosts(session, { ...options, retries: retries - 1 })
    }
    const error = new Error('Rate limit (429) após todas tentativas')
    error.code = 'RATE_LIMITED'
    error.statusCode = 429
    throw error
  }
  
  // Erros 5xx - retry
  if (response.statusCode >= 500) {
    if (retries > 0) {
      console.log(`   ⚠️ Erro ${response.statusCode}. Retry em ${RETRY_DELAY_MS/1000}s... (${retries} tentativas restantes)`)
      await sleep(RETRY_DELAY_MS)
      return fetchPosts(session, { ...options, retries: retries - 1 })
    }
    throw new Error(`Erro do servidor (${response.statusCode}) após todas tentativas`)
  }

  if (response.statusCode !== 200) {
    throw new Error(`HTTP ${response.statusCode}`)
  }
  
  const text = await response.body.text()
  
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new Error(`Response não é JSON válido: ${text.slice(0, 200)}`)
  }
}

/**
 * Extrai dados da response GraphQL
 * @param {Object} response - Response da API
 * @returns {Object} { edges, pageInfo }
 */
export function extractData(response) {
  const connection = response?.data?.xdt_api__v1__feed__user_timeline_graphql_connection
  
  if (!connection) {
    throw new Error('Estrutura de response inesperada')
  }
  
  return {
    edges: connection.edges || [],
    pageInfo: connection.page_info || {}
  }
}

export { DEFAULT_CYCLE_MS }

export default {
  fetchPosts,
  extractData,
  MAX_COUNT,
  DEFAULT_CYCLE_MS
}