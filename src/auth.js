// src/auth.js
// Automação de login Instagram via Puppeteer

import puppeteer from 'puppeteer'
import { readFile, writeFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const LOGIN_URL = 'https://www.instagram.com/accounts/login/'
const DEFAULT_SESSION_FILE = path.join(process.cwd(), '.session.json')
const SESSION_MAX_AGE_HOURS = 24 // Sessão válida por 24h

const sleep = ms => new Promise(r => setTimeout(r, ms))
const DEFAULT_TIMEOUT = 60000 // 60s para login manual se necessário

/**
 * Realiza login no Instagram e retorna cookies de sessão
 * 
 * @param {Object} credentials
 * @param {string} credentials.username - Username ou email
 * @param {string} credentials.password - Senha
 * @param {Object} options
 * @param {boolean} options.headless - Rodar sem interface (default: true)
 * @param {number} options.timeout - Timeout em ms (default: 60000)
 * @param {boolean} options.handleChallenge - Pausar para resolver desafios manualmente (default: true)
 * @returns {Promise<Object>} Cookies { sessionid, csrftoken, ds_user_id }
 */
export async function login(credentials, options = {}) {
  const {
    headless = true,
    timeout = DEFAULT_TIMEOUT,
    handleChallenge = true
  } = options

  const { username, password } = credentials

  if (!username || !password) {
    throw new Error('Username e password são obrigatórios')
  }

  console.log(`🔐 Iniciando login para @${username}...`)

  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  })

  try {
    const page = await browser.newPage()
    
    // Configurar user agent realista
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Configurar viewport
    await page.setViewport({ width: 1280, height: 800 })

    // Navegar para página de login
    console.log('   Navegando para página de login...')
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' })

    // Aguardar e fechar modal de cookies se aparecer
    try {
      const cookieButton = await page.waitForSelector(
        'button[tabindex="0"]:has-text("Allow"), button:has-text("Permitir"), button:has-text("Accept")',
        { timeout: 3000 }
      )
      if (cookieButton) await cookieButton.click()
    } catch {
      // Modal não apareceu, continuar
    }

    // Aguardar formulário de login
    console.log('   Aguardando formulário de login...')
    await page.waitForSelector('input[name="username"]', { timeout: 10000 })

    // Preencher credenciais com delay humano
    console.log('   Preenchendo credenciais...')
    
    const usernameInput = await page.$('input[name="username"]')
    await usernameInput.click()
    await page.keyboard.type(username, { delay: 50 + Math.random() * 50 })

    await sleep(500 + Math.random() * 500)

    const passwordInput = await page.$('input[name="password"]')
    await passwordInput.click()
    await page.keyboard.type(password, { delay: 50 + Math.random() * 50 })

    await sleep(500 + Math.random() * 500)

    // Clicar no botão de login
    console.log('   Enviando login...')
    const loginButton = await page.$('button[type="submit"]')
    await loginButton.click()

    // Aguardar resposta do login
    console.log('   Aguardando resposta...')
    
    // Possíveis outcomes após login:
    // 1. Sucesso → redireciona para feed ou perfil
    // 2. Erro → mostra mensagem de erro
    // 3. Challenge → 2FA, verificação por email/SMS, captcha
    // 4. "Save Login Info" → modal perguntando se quer salvar

    const result = await Promise.race([
      // Sucesso: chegou no feed ou qualquer página logada
      page.waitForSelector('svg[aria-label="Home"], svg[aria-label="Página inicial"]', { timeout })
        .then(() => ({ status: 'success' })),
      
      // Sucesso alternativo: modal "Save Your Login Info"
      page.waitForSelector('button:has-text("Save Info"), button:has-text("Salvar informações")', { timeout })
        .then(() => ({ status: 'save_info_prompt' })),
      
      // Sucesso alternativo: modal "Turn on Notifications"
      page.waitForSelector('button:has-text("Not Now"), button:has-text("Agora não")', { timeout })
        .then(() => ({ status: 'notifications_prompt' })),

      // Erro de credenciais
      page.waitForSelector('#slfErrorAlert, [data-testid="login-error-message"]', { timeout: 10000 })
        .then(async (el) => {
          const text = await el.evaluate(e => e.textContent)
          return { status: 'error', message: text }
        }),

      // Challenge de segurança (2FA, verificação)
      page.waitForSelector('input[name="verificationCode"], input[name="security_code"]', { timeout })
        .then(() => ({ status: 'challenge_2fa' })),

      // Outro tipo de challenge
      page.waitForSelector('[data-testid="challenge"]', { timeout })
        .then(() => ({ status: 'challenge_other' }))
    ])

    // Processar resultado
    if (result.status === 'error') {
      throw new Error(`Login falhou: ${result.message}`)
    }

    if (result.status.startsWith('challenge')) {
      if (handleChallenge) {
        console.log('\n⚠️  DESAFIO DE SEGURANÇA DETECTADO')
        console.log('   O Instagram pediu verificação adicional.')
        console.log('   Complete o desafio manualmente no browser...')
        console.log('   (Aguardando até 5 minutos)\n')

        // Aguarda usuário resolver manualmente
        await page.waitForSelector(
          'svg[aria-label="Home"], svg[aria-label="Página inicial"]',
          { timeout: 300000 } // 5 minutos
        )
        console.log('   ✅ Desafio resolvido!')
      } else {
        throw new Error(`Desafio de segurança detectado: ${result.status}`)
      }
    }

    // Fechar modais pós-login se aparecerem
    if (result.status === 'save_info_prompt' || result.status === 'notifications_prompt') {
      try {
        const notNowBtn = await page.$('button:has-text("Not Now"), button:has-text("Agora não")')
        if (notNowBtn) await notNowBtn.click()
        await sleep(1000)
      } catch {
        // Ignorar
      }
    }

    // Extrair cookies
    console.log('   Extraindo cookies...')
    const cookies = await extractSessionCookies(page)

    console.log('✅ Login realizado com sucesso!')
    
    return cookies

  } finally {
    await browser.close()
  }
}

/**
 * Extrai cookies de sessão da página
 * @param {Page} page - Puppeteer page
 * @returns {Object} { sessionid, csrftoken, ds_user_id }
 */
async function extractSessionCookies(page) {
  const cookies = await page.cookies()
  
  const cookieMap = {}
  for (const cookie of cookies) {
    cookieMap[cookie.name] = cookie.value
  }

  const sessionid = cookieMap.sessionid
  const csrftoken = cookieMap.csrftoken
  const ds_user_id = cookieMap.ds_user_id

  if (!sessionid) {
    throw new Error('Cookie sessionid não encontrado - login pode ter falhado')
  }

  if (!csrftoken) {
    throw new Error('Cookie csrftoken não encontrado')
  }

  return { sessionid, csrftoken, ds_user_id }
}

/**
 * Carrega credenciais de variáveis de ambiente
 * @returns {Object} { username, password }
 */
export function loadCredentialsFromEnv() {
  const username = process.env.INSTAGRAM_USERNAME
  const password = process.env.INSTAGRAM_PASSWORD

  if (!username || !password) {
    throw new Error(
      'Credenciais não encontradas. Defina INSTAGRAM_USERNAME e INSTAGRAM_PASSWORD no ambiente ou em .env'
    )
  }

  return { username, password }
}

/**
 * Login usando credenciais do ambiente
 * @param {Object} options - Opções do login
 * @returns {Promise<Object>} Cookies
 */
export async function loginFromEnv(options = {}) {
  const credentials = loadCredentialsFromEnv()
  return login(credentials, options)
}

/**
 * Salva cookies de sessão em arquivo
 * @param {Object} cookies - { sessionid, csrftoken, ds_user_id }
 * @param {string} filePath - Caminho do arquivo (default: .session.json)
 */
export async function saveSession(cookies, filePath = DEFAULT_SESSION_FILE) {
  const data = {
    ...cookies,
    savedAt: new Date().toISOString()
  }
  await writeFile(filePath, JSON.stringify(data, null, 2))
  console.log(`💾 Sessão salva em ${filePath}`)
}

/**
 * Carrega cookies de sessão do arquivo
 * @param {string} filePath - Caminho do arquivo
 * @param {number} maxAgeHours - Idade máxima em horas (default: 24)
 * @returns {Object|null} Cookies ou null se expirado/inexistente
 */
export async function loadSession(filePath = DEFAULT_SESSION_FILE, maxAgeHours = SESSION_MAX_AGE_HOURS) {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const content = await readFile(filePath, 'utf-8')
    const data = JSON.parse(content)

    // Verificar idade
    const savedAt = new Date(data.savedAt)
    const ageHours = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60)

    if (ageHours > maxAgeHours) {
      console.log(`⏰ Sessão expirada (${ageHours.toFixed(1)}h > ${maxAgeHours}h)`)
      return null
    }

    console.log(`📂 Sessão carregada (${ageHours.toFixed(1)}h de idade)`)
    return {
      sessionid: data.sessionid,
      csrftoken: data.csrftoken,
      ds_user_id: data.ds_user_id
    }
  } catch (error) {
    console.log(`⚠️ Erro ao carregar sessão: ${error.message}`)
    return null
  }
}

/**
 * Obtém cookies - carrega do cache ou faz login
 * @param {Object} options
 * @param {boolean} options.forceLogin - Forçar novo login mesmo com sessão válida
 * @param {string} options.sessionFile - Caminho do arquivo de sessão
 * @param {number} options.maxAgeHours - Idade máxima da sessão
 * @param {Object} options.loginOptions - Opções para o login (headless, etc)
 * @returns {Promise<Object>} Cookies
 */
export async function getSession(options = {}) {
  const {
    forceLogin = false,
    sessionFile = DEFAULT_SESSION_FILE,
    maxAgeHours = SESSION_MAX_AGE_HOURS,
    loginOptions = {}
  } = options

  // Tenta carregar sessão existente
  if (!forceLogin) {
    const cached = await loadSession(sessionFile, maxAgeHours)
    if (cached) {
      return cached
    }
  }

  // Faz novo login
  console.log('🔄 Obtendo nova sessão...')
  const cookies = await loginFromEnv(loginOptions)
  
  // Salva para próximas execuções
  await saveSession(cookies, sessionFile)
  
  return cookies
}

export default {
  login,
  loginFromEnv,
  loadCredentialsFromEnv,
  saveSession,
  loadSession,
  getSession
}
