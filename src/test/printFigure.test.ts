// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { figurePrintHtml, svgSize } from '@/lib/printFigure'

const wide = '<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="180" viewBox="0 0 1240 180"><text>Rotation 1</text></svg>'
const tall = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="900" viewBox="0 0 300 900"></svg>'

describe('svgSize', () => {
  it('reads the root width and height', () => {
    expect(svgSize(wide)).toEqual({ width: 1240, height: 180 })
  })

  it('ignores sizes on inner elements', () => {
    expect(svgSize('<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>')).toBeNull()
  })
})

describe('figurePrintHtml', () => {
  it('puts the figure alone on a landscape page', () => {
    const html = figurePrintHtml(wide, 'alive-form-diagram')
    const page = new DOMParser().parseFromString(html, 'text/html')
    expect(page.title).toBe('alive-form-diagram')
    expect(page.body.children).toHaveLength(1)
    expect(page.body.querySelector('svg text')?.textContent).toBe('Rotation 1')
    expect(html).toContain('size: landscape')
  })

  it('turns the page for a figure taller than it is wide', () => {
    expect(figurePrintHtml(tall, 't')).toContain('size: portrait')
  })

  it('escapes the title', () => {
    const page = new DOMParser().parseFromString(figurePrintHtml(wide, '<b>A & B</b>'), 'text/html')
    expect(page.title).toBe('<b>A & B</b>')
    expect(page.head.querySelector('b')).toBeNull()
  })
})
