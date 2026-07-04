import { render, screen } from '@testing-library/react'
import { BrandLogo } from '@/components/brand/BrandLogo'

describe('BrandLogo', () => {
  it('renders the exact lockup wording', () => {
    render(<BrandLogo variant="lockup" size={48} treatment="bare" />)

    expect(screen.getByText('DengueWatch')).toBeInTheDocument()
    expect(screen.getByText('MOSQUITO ALERT')).toBeInTheDocument()
  })

  it('renders the mark without lockup text', () => {
    render(<BrandLogo variant="mark" size={48} treatment="framed" />)

    expect(screen.queryByText('DengueWatch')).not.toBeInTheDocument()
    expect(screen.queryByText('MOSQUITO ALERT')).not.toBeInTheDocument()
  })

  it('supports the approved sizes and treatments', () => {
    const { rerender } = render(<BrandLogo variant="mark" size={32} treatment="bare" />)

    let logo = screen.getByTestId('brand-logo')
    expect(logo).toHaveAttribute('data-size', '32')
    expect(logo).toHaveAttribute('data-treatment', 'bare')

    rerender(<BrandLogo variant="mark" size={48} treatment="framed" />)
    logo = screen.getByTestId('brand-logo')
    expect(logo).toHaveAttribute('data-size', '48')
    expect(logo).toHaveAttribute('data-treatment', 'framed')

    rerender(<BrandLogo variant="lockup" size={80} treatment="bare" />)
    logo = screen.getByTestId('brand-logo')
    expect(logo).toHaveAttribute('data-size', '80')
    expect(logo).toHaveAttribute('data-variant', 'lockup')
  })

  it('keeps the SVG decorative', () => {
    render(<BrandLogo variant="lockup" size={48} treatment="bare" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('DengueWatch')).toBeVisible()
  })
})
