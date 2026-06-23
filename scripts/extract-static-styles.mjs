import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const sourceRoot = path.join(process.cwd(), 'src')
const generatedPath = path.join(sourceRoot, 'styles/generated-utilities.css')
const unitless = new Set([
  'aspectRatio',
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'gridColumn',
  'gridRow',
  'lineHeight',
  'opacity',
  'order',
  'zIndex',
])

function collectTsx(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectTsx(target)
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [target] : []
  })
}

function declarationList(object, sourceFile) {
  const declarations = []
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) return null
    const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
      ? property.name.text
      : property.name.getText(sourceFile)
    const value = ts.isStringLiteral(property.initializer)
      ? property.initializer.text
      : ts.isNumericLiteral(property.initializer)
        ? Number(property.initializer.text) === 0 || unitless.has(name)
          ? property.initializer.text
          : `${property.initializer.text}px`
        : null
    if (value === null) return null
    declarations.push(`${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value}`)
  }
  return declarations.sort()
}

const rules = new Map()
let migrated = 0

for (const file of collectTsx(sourceRoot)) {
  const source = fs.readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const replacements = []

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const style = node.attributes.properties.find(
        (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === 'style',
      )
      if (
        style &&
        ts.isJsxAttribute(style) &&
        style.initializer &&
        ts.isJsxExpression(style.initializer) &&
        style.initializer.expression &&
        ts.isObjectLiteralExpression(style.initializer.expression)
      ) {
        const declarations = declarationList(style.initializer.expression, sourceFile)
        if (declarations) {
          const signature = declarations.join('; ')
          const className = `u-static-${crypto.createHash('sha1').update(signature).digest('hex').slice(0, 8)}`
          rules.set(className, declarations)
          const existingClass = node.attributes.properties.find(
            (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === 'className',
          )

          if (
            existingClass &&
            ts.isJsxAttribute(existingClass) &&
            existingClass.initializer &&
            ts.isStringLiteral(existingClass.initializer)
          ) {
            replacements.push({
              start: existingClass.initializer.getStart(sourceFile),
              end: existingClass.initializer.getEnd(),
              text: `"${existingClass.initializer.text} ${className}"`,
            })
            replacements.push({
              start: style.getStart(sourceFile),
              end: style.getEnd(),
              text: '',
            })
          } else if (!existingClass) {
            replacements.push({
              start: style.getStart(sourceFile),
              end: style.getEnd(),
              text: `className="${className}"`,
            })
          }
          migrated += 1
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (replacements.length > 0) {
    let next = source
    for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
      next = `${next.slice(0, replacement.start)}${replacement.text}${next.slice(replacement.end)}`
    }
    fs.writeFileSync(file, next)
  }
}

const generated = [
  '@layer utilities {',
  ...[...rules.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([className, declarations]) => `  .${className} { ${declarations.join('; ')}; }`),
  '}',
  '',
].join('\n')

fs.writeFileSync(generatedPath, generated)
console.log(`Extracted ${migrated} static style objects into ${rules.size} deduplicated utility rules.`)
