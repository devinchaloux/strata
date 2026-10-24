// @vitest-environment jsdom
/**
 * A popover closes on a press outside it, even where the press is handled and
 * stopped (the diagram's spans do this), but not on one inside a panel opened
 * from it.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function renderMenu() {
  render(
    <>
      <div data-testid="span" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
      <Popover>
        <PopoverTrigger>Menu</PopoverTrigger>
        <PopoverContent>
          <p>Inside</p>
        </PopoverContent>
      </Popover>
    </>,
  )
  fireEvent.click(screen.getByText('Menu'))
}

afterEach(cleanup)

describe('Popover', () => {
  it('closes on a press outside, even one that is stopped', async () => {
    renderMenu()
    expect(screen.getByText('Inside')).toBeTruthy()
    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('span'))
    })
    expect(screen.queryByText('Inside')).toBeNull()
  })

  it('stays open on a press inside', async () => {
    renderMenu()
    await act(async () => {
      fireEvent.pointerDown(screen.getByText('Inside'))
    })
    expect(screen.getByText('Inside')).toBeTruthy()
  })
})
