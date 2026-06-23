import fs from 'node:fs'
import process from 'node:process'
import postcss from 'postcss'

const legacyPath = 'src/styles/legacy.css'
const canonicalPath = 'src/styles/stitch.css'

function normalize(selector) {
  return selector.trim().replace(/\s+/g, ' ')
}

const canonicalRoot = postcss.parse(fs.readFileSync(canonicalPath, 'utf8'), { from: canonicalPath })
const canonicalSelectors = new Set()

canonicalRoot.walkRules((rule) => {
  for (const selector of postcss.list.comma(rule.selector)) {
    canonicalSelectors.add(normalize(selector))
  }
})

const legacyRoot = postcss.parse(fs.readFileSync(legacyPath, 'utf8'), { from: legacyPath })
let removedSelectors = 0
let removedRules = 0

legacyRoot.walkRules((rule) => {
  const selectors = postcss.list.comma(rule.selector)
  const retained = selectors.filter((selector) => !canonicalSelectors.has(normalize(selector)))
  removedSelectors += selectors.length - retained.length

  if (retained.length === 0) {
    rule.remove()
    removedRules += 1
  } else if (retained.length !== selectors.length) {
    rule.selector = retained.join(',\n')
  }
})

console.log(`Legacy dedupe would remove ${removedSelectors} selectors across ${removedRules} complete rules.`)

if (process.argv.includes('--write')) {
  fs.writeFileSync(legacyPath, legacyRoot.toString())
  console.log(`Updated ${legacyPath}.`)
}
