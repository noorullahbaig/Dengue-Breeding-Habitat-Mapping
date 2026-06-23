import ts from 'typescript'

const deprecatedClasses = [
  'panel',
  'app-card',
  'glass-panel',
  'info-strip',
]

function selectorSet(content) {
  const selectors = new Set()
  const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '')

  for (const match of withoutComments.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const raw = match[1].trim()
    if (
      raw.startsWith('@') ||
      raw === 'from' ||
      raw === 'to' ||
      /^\d+%$/.test(raw)
    ) {
      continue
    }

    for (const selector of raw.split(',')) {
      const normalized = selector.trim().replace(/\s+/g, ' ')
      if (normalized) selectors.add(normalized)
    }
  }

  return selectors
}

export function analyzeUiSources({ tsxFiles, cssFiles }) {
  let staticInlineStyles = 0
  let rawColors = 0
  let deprecatedClassReferences = 0

  for (const file of tsxFiles) {
    const sourceFile = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )

    function visit(node) {
      if (
        ts.isJsxAttribute(node) &&
        node.name.getText(sourceFile) === 'style' &&
        node.initializer &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression &&
        ts.isObjectLiteralExpression(node.initializer.expression)
      ) {
        const isStatic = node.initializer.expression.properties.every(
          (property) =>
            ts.isPropertyAssignment(property) &&
            (ts.isStringLiteral(property.initializer) || ts.isNumericLiteral(property.initializer)),
        )
        if (isStatic) staticInlineStyles += 1
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    deprecatedClassReferences += deprecatedClasses.reduce((count, className) => {
      const expression = new RegExp(`(?:^|[\\s"'\\x60])${className}(?=$|[\\s"'\\x60])`, 'g')
      return count + [...file.content.matchAll(expression)].length
    }, 0)

    if (!file.path.includes('/map') && !file.path.includes('PredictionEvidence')) {
      rawColors += [...file.content.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)].length
    }
  }

  for (const file of cssFiles) {
    if (!file.path.endsWith('tokens.css')) {
      rawColors += [...file.content.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)].length
    }
  }

  const selectorOwners = new Map()
  for (const file of cssFiles) {
    for (const selector of selectorSet(file.content)) {
      const owners = selectorOwners.get(selector) ?? []
      owners.push(file.path)
      selectorOwners.set(selector, owners)
    }
  }

  const crossFileSelectorCollisions = [...selectorOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([selector]) => selector)
    .sort()

  return {
    staticInlineStyles,
    rawColors,
    deprecatedClassReferences,
    crossFileSelectorCollisions,
  }
}
