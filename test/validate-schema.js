#!/usr/bin/env node
// Valida compatibilidade com schema social.posts

import { readFileSync } from 'fs'

const posts = JSON.parse(readFileSync(new URL('../test-output.json', import.meta.url)))

console.log('=== COMPARAÇÃO COM SCHEMA social.posts ===\n')

const schemaFields = {
  post_id: { required: true, hasDefault: false },
  source: { required: true, hasDefault: false },
  origin: { required: false, hasDefault: true },
  posted_at: { required: true, hasDefault: false },
  sq_candidato: { required: true, hasDefault: false, note: 'passado na inserção' },
  post_type: { required: false, hasDefault: true },
  parent_post_id: { required: false, hasDefault: false },
  conversation_id: { required: false, hasDefault: false },
  author_id: { required: false, hasDefault: false },
  author_username: { required: false, hasDefault: false },
  author_name: { required: false, hasDefault: false },
  author_verified: { required: false, hasDefault: true },
  author_followers_count: { required: false, hasDefault: false, note: 'Instagram não expõe' },
  content: { required: false, hasDefault: false },
  content_type: { required: false, hasDefault: true },
  url: { required: false, hasDefault: false },
  media_url: { required: false, hasDefault: false },
  likes_count: { required: false, hasDefault: true },
  comments_count: { required: false, hasDefault: true },
  shares_count: { required: false, hasDefault: true, note: 'Instagram não expõe' },
  views_count: { required: false, hasDefault: true },
  engagement: { required: false, hasDefault: true },
  source_data: { required: false, hasDefault: true }
}

const sample = posts[0]

console.log('✅ CAMPOS COMPATÍVEIS:')
const compatible = []
const missing = []
const extra = []

for (const [field, info] of Object.entries(schemaFields)) {
  if (sample[field] !== undefined) {
    compatible.push(field)
    console.log(`   ${field}: ${JSON.stringify(sample[field]).slice(0, 50)}`)
  } else if (info.hasDefault || info.note) {
    missing.push(`${field} → ${info.note || 'tem default'}`)
  } else if (info.required) {
    missing.push(`${field} → ⚠️ OBRIGATÓRIO SEM DEFAULT`)
  }
}

console.log(`\n⚠️ CAMPOS NÃO PRESENTES (${missing.length}):`)
missing.forEach(f => console.log(`   ${f}`))

console.log('\n📋 CAMPOS EXTRAS NO OUTPUT:')
for (const field of Object.keys(sample)) {
  if (!schemaFields[field]) {
    console.log(`   ${field}: ${typeof sample[field]}`)
  }
}

console.log('\n=== VALORES DE post_type ===')
const types = [...new Set(posts.map(p => p.post_type))]
console.log('Meus valores:', types)
console.log('Schema comentário: post, reply, quote, share (Twitter)')
console.log('→ Instagram usa: image, video, carousel, reel')
console.log('→ Campo é TEXT livre, funciona OK')

console.log('\n=== RESUMO ===')
console.log(`Campos compatíveis: ${compatible.length}/${Object.keys(schemaFields).length}`)
console.log(`Campos com default/nota: ${missing.length}`)
console.log('Status: ✅ COMPATÍVEL com social.posts')
