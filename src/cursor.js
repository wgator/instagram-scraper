// src/cursor.js
// Manipulação de cursores Instagram (formato Snowflake)

const INSTAGRAM_EPOCH = 1314220021721n // ms (Set 2011)

/**
 * Converte timestamp em Post ID aproximado
 * @param {number|Date} date - Timestamp ms ou Date
 * @returns {bigint} Post ID sintético
 */
export function timestampToPostId(date) {
  const ms = date instanceof Date ? date.getTime() : date
  return (BigInt(ms) - INSTAGRAM_EPOCH) << 23n
}

/**
 * Converte Post ID em timestamp
 * @param {string|bigint} postId - Post ID
 * @returns {number} Timestamp em ms
 */
export function postIdToTimestamp(postId) {
  const id = typeof postId === 'string' ? BigInt(postId) : postId
  return Number((id >> 23n) + INSTAGRAM_EPOCH)
}

/**
 * Cria cursor sintético para uma data específica
 * @param {Date|string} date - Data alvo
 * @param {string} userId - ID do usuário
 * @returns {string} Cursor no formato "{postId}_{userId}"
 */
export function createCursor(date, userId) {
  const targetDate = typeof date === 'string' ? new Date(date) : date
  const syntheticPostId = timestampToPostId(targetDate.getTime())
  return `${syntheticPostId}_${userId}`
}

/**
 * Extrai timestamp de um cursor
 * @param {string} cursor - Cursor no formato "{postId}_{userId}"
 * @returns {Date} Data aproximada do cursor
 */
export function cursorToDate(cursor) {
  const [postId] = cursor.split('_')
  return new Date(postIdToTimestamp(postId))
}

export default {
  timestampToPostId,
  postIdToTimestamp,
  createCursor,
  cursorToDate,
  INSTAGRAM_EPOCH
}
