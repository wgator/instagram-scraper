#!/usr/bin/env node
// test/auth.js
// Teste do módulo de autenticação

import { getSession } from '../src/auth.js'

const forceLogin = process.argv.includes('--force')

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Instagram Scraper - Teste de Autenticação                     ║
╚════════════════════════════════════════════════════════════════╝
`)

  if (forceLogin) {
    console.log('🔄 Modo: forçar novo login (--force)\n')
  }

  try {
    const cookies = await getSession({
      forceLogin,
      loginOptions: { headless: false }  // Sempre mostrar browser para debug
    })

    console.log('\n📋 Cookies obtidos:')
    console.log(`   sessionid:  ${cookies.sessionid.slice(0, 20)}...`)
    console.log(`   csrftoken:  ${cookies.csrftoken}`)
    console.log(`   ds_user_id: ${cookies.ds_user_id}`)

    console.log('\n✅ Sessão pronta para uso!')

  } catch (error) {
    console.error(`\n❌ Erro: ${error.message}`)
    
    if (error.message.includes('Credenciais não encontradas')) {
      console.log(`
💡 Configure as credenciais:

   1. Crie o arquivo .env na raiz do projeto:
      cp .env.example .env

   2. Edite .env com suas credenciais:
      INSTAGRAM_USERNAME=seu_usuario
      INSTAGRAM_PASSWORD=sua_senha

   3. Rode novamente:
      npm run test:auth
`)
    }
    
    process.exit(1)
  }
}

main()
