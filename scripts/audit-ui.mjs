import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { analyzeUiSources } from './ui-audit-core.mjs'

const root = process.cwd()

function collectFiles(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(target, extension)
    return entry.name.endsWith(extension) ? [target] : []
  })
}

function sourceFile(file) {
  return {
    path: path.relative(root, file),
    content: fs.readFileSync(file, 'utf8'),
  }
}

const result = analyzeUiSources({
  tsxFiles: collectFiles(path.join(root, 'src'), '.tsx').map(sourceFile),
  cssFiles: collectFiles(path.join(root, 'src/styles'), '.css').map(sourceFile),
})

const summary = {
  staticInlineStyles: result.staticInlineStyles,
  rawColors: result.rawColors,
  deprecatedClassReferences: result.deprecatedClassReferences,
  crossFileSelectorCollisions: result.crossFileSelectorCollisions.length,
}

if (process.argv.includes('--print-json')) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  process.exit(0)
}

const baselinePath = path.join(root, 'scripts/ui-audit-baseline.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const failures = Object.entries(summary)
  .filter(([metric, value]) => value > baseline[metric])
  .map(([metric, value]) => `${metric}: ${value} exceeds baseline ${baseline[metric]}`)

console.log('UI DRY audit')
for (const [metric, value] of Object.entries(summary)) {
  console.log(`- ${metric}: ${value} (maximum ${baseline[metric]})`)
}

if (failures.length > 0) {
  console.error('\nUI audit failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
