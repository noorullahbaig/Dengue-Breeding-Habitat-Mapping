import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import postcss from 'postcss'

const sourceRoot = 'src'
const stylesheetPath = process.argv.find((argument) => argument.endsWith('.css')) ?? 'src/styles/legacy.css'

function collectFiles(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(target, extension)
    return entry.name.endsWith(extension) ? [target] : []
  })
}

const usedClasses = new Set()
for (const file of collectFiles(sourceRoot, '.tsx')) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/className\s*=\s*["']([^"']+)["']/g)) {
    for (const className of match[1].split(/\s+/)) {
      if (className) usedClasses.add(className)
    }
  }
  for (const match of source.matchAll(/className\s*=\s*\{`([^`]*)`/g)) {
    for (const className of match[1].replace(/\$\{[\s\S]*?\}/g, ' ').split(/\s+/)) {
      if (/^[A-Za-z_][\w-]*$/.test(className)) usedClasses.add(className)
    }
  }
  for (const match of source.matchAll(/[A-Za-z][\w-]*(?:__[\w-]+|--[\w-]+|-[\w-]+)+/g)) {
    usedClasses.add(match[0])
  }
}

function classIsUsed(className) {
  if (usedClasses.has(className)) return true
  const modifierIndex = className.indexOf('--')
  return modifierIndex > 0 && usedClasses.has(className.slice(0, modifierIndex))
}

function selectorIsUsed(selector) {
  const classes = [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1])
  return classes.length === 0 || classes.every(classIsUsed)
}

const root = postcss.parse(fs.readFileSync(stylesheetPath, 'utf8'), { from: stylesheetPath })
let removedSelectors = 0
let removedRules = 0

root.walkRules((rule) => {
  const selectors = postcss.list.comma(rule.selector)
  const retained = selectors.filter(selectorIsUsed)
  removedSelectors += selectors.length - retained.length

  if (retained.length === 0) {
    rule.remove()
    removedRules += 1
  } else if (retained.length !== selectors.length) {
    rule.selector = retained.join(',\n')
  }
})

console.log(`Purge would remove ${removedSelectors} unused selectors across ${removedRules} complete rules from ${stylesheetPath}.`)

if (process.argv.includes('--write')) {
  fs.writeFileSync(stylesheetPath, root.toString())
  console.log(`Updated ${stylesheetPath}.`)
}
