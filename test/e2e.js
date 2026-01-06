#!/usr/bin/env node
// test/e2e.js
// Teste end-to-end: login + coleta de posts

import InstagramScraper from '../src/index.js'

// Flags
const fastMode = process.argv.includes('--fast')  // Sem delay (apenas para teste)

// Configuração do teste
const TEST_PROFILE = {
  username: 'deputadomarcosmuller',
  userId: '1187782648'
}

// Período pequeno: apenas setembro 2022 (1 mês)
const PERIOD = {
  since: '2022-09-01',
  until: '2022-09-30'
}

// Rate limiting: 4s por ciclo completo (~900 req/h)
// Em modo --fast, sem delay (só para testes rápidos!)
const CYCLE_MS = fastMode ? 0 : 4000

async function main() {
  const rateInfo = fastMode 
    ? '⚡ FAST MODE (sem rate limit - só para teste!)'
    : `⏱️ Rate limit: ${CYCLE_MS/1000}s por ciclo (~900 req/h)`

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Instagram Scraper - Teste End-to-End                          ║
╠════════════════════════════════════════════════════════════════╣
║  Perfil:  @${TEST_PROFILE.username.padEnd(47)}║
║  Período: ${PERIOD.since} a ${PERIOD.until}                          ║
╠════════════════════════════════════════════════════════════════╣
║  ${rateInfo.padEnd(59)}║
╚════════════════════════════════════════════════════════════════╝
`)

  try {
    // Cria scraper com sessão cacheada
    console.log('🔑 Obtendo sessão...')
    const scraper = await InstagramScraper.createWithSession()
    console.log('✅ Scraper pronto!\n')

    console.log('📥 Iniciando coleta...\n')
    
    let count = 0
    const startTime = Date.now()
    const posts = []
    
    for await (const post of scraper.collect({
      username: TEST_PROFILE.username,
      userId: TEST_PROFILE.userId,
      since: PERIOD.since,
      until: PERIOD.until,
      cycleMs: CYCLE_MS,
      onProgress: ({ requestCount, totalCollected, oldestDate }) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
        console.log(`   [${elapsed}s] Request #${requestCount}: ${totalCollected} posts (até ${oldestDate?.split('T')[0] || '?'})`)
      }
    })) {
      count++
      posts.push(post)
      
      // Mostra primeiros 3 posts como amostra
      if (count <= 3) {
        const caption = (post.content || '(sem caption)').slice(0, 50).replace(/\n/g, ' ')
        console.log(`\n   📝 [${post.posted_at?.split('T')[0]}] ${caption}...`)
        console.log(`      ❤️ ${post.likes_count} 💬 ${post.comments_count} | ${post.post_type}`)
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

    // Mostra distribuição por tipo
    const byType = {}
    for (const p of posts) {
      byType[p.post_type] = (byType[p.post_type] || 0) + 1
    }
    console.log('   Por tipo:', byType)

    // Mostra range de datas
    if (posts.length > 0) {
      const dates = posts.map(p => p.posted_at).sort()
      console.log(`   Período real: ${dates[0]?.split('T')[0]} a ${dates[dates.length-1]?.split('T')[0]}`)
    }

    // Salva posts para inspeção
    const outPath = new URL('../test-output.json', import.meta.url).pathname
    const { writeFile } = await import('fs/promises')
    await writeFile(outPath, JSON.stringify(posts, null, 2))
    console.log(`\n💾 Posts salvos em: ${outPath}`)

  } catch (error) {
    console.error(`\n❌ Erro: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
