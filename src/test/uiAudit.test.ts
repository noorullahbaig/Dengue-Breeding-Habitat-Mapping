import { analyzeUiSources } from '../../scripts/ui-audit-core.mjs'

describe('UI audit analyzer', () => {
  it('counts static inline styles, raw colors, deprecated classes, and selector collisions', () => {
    const result = analyzeUiSources({
      tsxFiles: [{
        path: 'Page.tsx',
        content: '<div className="panel" style={{ padding: "1rem" }} />',
      }],
      cssFiles: [
        { path: 'a.css', content: '.button { color: #fff; }' },
        { path: 'b.css', content: '.button { color: var(--color-ink); }' },
      ],
    })

    expect(result.staticInlineStyles).toBe(1)
    expect(result.rawColors).toBe(1)
    expect(result.deprecatedClassReferences).toBe(1)
    expect(result.crossFileSelectorCollisions).toEqual(['.button'])
  })
})
