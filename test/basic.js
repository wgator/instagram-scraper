#!/usr/bin/env node
// test/basic.js
// Teste básico do scraper

import InstagramScraper from '../src/index.js'

// ═══════════════════════════════════════════════════════════════
// CONFIGURAÇÃO - Preencha com seus cookies
// ═══════════════════════════════════════════════════════════════
const COOKIES = {
  sessionid: 'SEU_SESSION_ID_AQUI',
  csrftoken: 'SEU_CSRF_TOKEN_AQUI',
  ds_user_id: 'SEU_USER_ID_AQUI'
}

const TEST_PROFILE = {
  username: 'deputadomarcosmuller',
  userId: '1187782648'
}

const PERIOD = {
  since: '2022-01-01',
  until: '2022-10-02'
}
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Instagram Scraper - Teste Básico                              ║
╠════════════════════════════════════════════════════════════════╣
║  Perfil:  @${TEST_PROFILE.username.padEnd(47)}║
║  Período: ${PERIOD.since} a ${PERIOD.until}                          ║
╚════════════════════════════════════════════════════════════════╝
`)

  if (COOKIES.sessionid === 'SEU_SESSION_ID_AQUI') {
    console.error('❌ Configure os cookies antes de rodar!')
    console.log('\nPegue os cookies no DevTools > Application > Cookies > instagram.com')
    process.exit(1)
  }

  try {
    console.log('🔑 Criando sessão...')
    const scraper = await InstagramScraper.create(COOKIES)
    console.log('✅ Sessão criada com sucesso!\n')

    console.log('📥 Iniciando coleta...\n')
    
    let count = 0
    const startTime = Date.now()
    
    for await (const post of scraper.collect({
      username: TEST_PROFILE.username,
      userId: TEST_PROFILE.userId,
      since: PERIOD.since,
      until: PERIOD.until,
      onProgress: ({ requestCount, totalCollected, oldestDate }) => {
        console.log(`   Request #${requestCount}: ${totalCollected} posts (até ${oldestDate?.split('T')[0]})`)
      }
    })) {
      count++
      
      // Mostra primeiros 3 posts como amostra
      if (count <= 3) {
        const caption = (post.content || '(sem caption)').slice(0, 60).replace(/\n/g, ' ')
        console.log(`\n   📝 [${post.posted_at.split('T')[0]}] ${caption}...`)
        console.log(`      ❤️ ${post.likes_count} 💬 ${post.comments_count}`)
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log(`
${'═'.repeat(60)}
📊 RESULTADO
${'═'.repeat(60)}
   Posts coletados: ${count}
   Tempo total:     ${duration}s
   Posts/segundo:   ${(count / duration).toFixed(1)}
`)

  } catch (error) {
    console.error(`\n❌ Erro: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
