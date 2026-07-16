import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LearnPage } from '@/pages/LearnPage'

const WHO_SOURCE = 'https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue'
const MALAYSIA_HEALTH_INDICATORS_SOURCE =
	'https://www.moh.gov.my/moh/resources/Penerbitan/Penerbitan%20Utama/HEALTH%20INDICATOR/PETUNJUK_KESIHATAN_2025.pdf'

function renderLearnPage() {
	return render(
		<MemoryRouter initialEntries={['/learn']}>
			<LearnPage />
		</MemoryRouter>,
	)
}

function visibleWordCount(text: string) {
	return text.trim().split(/\s+/).filter(Boolean).length
}

describe('LearnPage problem-to-action guide', () => {
	it('presents six purposeful sections in problem, recognition, action, and platform order', () => {
		const { container } = renderLearnPage()

		expect(
			screen.getByRole('heading', {
				level: 1,
				name: 'Dengue is a growing threat, and prevention starts close to home.',
			}),
		).toBeInTheDocument()

		expect(
			[...container.querySelectorAll<HTMLElement>('[data-learn-section]')].map(
				(section) => section.dataset.learnSection,
			),
		).toEqual(['problem', 'habitats', 'action', 'evidence', 'platform', 'final'])
		expect(screen.getByText('01 Recognise the habitat')).toBeInTheDocument()
		expect(screen.getByText('02 Take safe action')).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 2, name: 'How DengueWatch helps' })).toBeInTheDocument()

		const words = visibleWordCount(container.textContent ?? '')
		expect(words).toBeGreaterThanOrEqual(340)
		expect(words).toBeLessThanOrEqual(390)
		expect(words).toBeLessThan(400)
	})

	it('establishes the problem with sourced global and Malaysian statistics', () => {
		renderLearnPage()
		const hero = screen.getByRole('region', {
			name: 'Dengue is a growing threat, and prevention starts close to home.',
		})

		expect(within(hero).getByText('1 in 2')).toBeInTheDocument()
		expect(within(hero).getByText('100–400M')).toBeInTheDocument()
		expect(within(hero).getByText('122,423')).toBeInTheDocument()
		expect(within(hero).getByText(/Full-year 2024/i)).toBeInTheDocument()

		const sourceLinks = within(hero).getAllByRole('link')
		expect(sourceLinks.some((link) => link.getAttribute('href') === WHO_SOURCE)).toBe(true)
		expect(
			sourceLinks.some((link) => link.getAttribute('href') === MALAYSIA_HEALTH_INDICATORS_SOURCE),
		).toBe(true)
	})

	it('teaches only the three habitat categories supported by the application', () => {
		const { container } = renderLearnPage()
		const habitatGuides = [...container.querySelectorAll<HTMLElement>('[data-habitat]')]

		expect(habitatGuides).toHaveLength(3)
		expect(habitatGuides.map((guide) => guide.dataset.habitat)).toEqual([
			'tire',
			'drain_inlet',
			'artificial_container',
		])
		expect(screen.getByRole('heading', { level: 3, name: 'Tires' })).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 3, name: 'Drain inlets' })).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 3, name: 'Artificial containers' })).toBeInTheDocument()
		expect(screen.getByText(/cannot confirm mosquito breeding/i)).toBeInTheDocument()
	})

	it('teaches a readable safety-first reporting sequence and correct destinations', () => {
		renderLearnPage()
		const action = screen.getByRole('region', { name: 'Found a possible site? Report it safely.' })
		const evidence = screen.getByRole('region', {
			name: 'A useful report shows the site, not just the water',
		})

		expect(within(action).getByText(/Keep a safe distance/i)).toBeInTheDocument()
		expect(within(action).getByRole('link', { name: 'Start report' })).toHaveAttribute('href', '/report')
		expect(within(evidence).getByText('Show the whole object')).toBeInTheDocument()
		expect(within(evidence).getByText('Show the water-holding area')).toBeInTheDocument()
		expect(within(evidence).getByText('Include surrounding context')).toBeInTheDocument()
		expect(within(evidence).getByText('Avoid')).toBeInTheDocument()

		const copy = evidence.textContent ?? ''
		expect(copy.indexOf('Confirm this exact site')).toBeLessThan(copy.indexOf('Review consent'))
		expect(copy).toMatch(/public image and exact map pin/i)

		expect(screen.getByRole('link', { name: 'Learn what to look for' })).toHaveAttribute(
			'href',
			'#recognise',
		)
		expect(screen.getByRole('link', { name: 'View dengue map' })).toHaveAttribute('href', '/map')
		expect(screen.getAllByRole('link', { name: 'Start report' })).toHaveLength(2)
		expect(screen.getByRole('link', { name: 'View map' })).toHaveAttribute('href', '/map')
	})

	it('explains the real platform sequence without implying verification or action', () => {
		renderLearnPage()
		const platform = screen.getByRole('region', { name: 'How DengueWatch helps' })

		const copy = platform.textContent ?? ''
		expect(copy).toMatch(/Category advisory/i)
		expect(copy).toMatch(/Area context added/i)
		expect(copy.indexOf('Category advisory')).toBeLessThan(copy.indexOf('You confirm and submit'))
		expect(copy.indexOf('You confirm and submit')).toBeLessThan(copy.indexOf('Report record created'))
		expect(copy.indexOf('Report record created')).toBeLessThan(copy.indexOf('Area context added'))
		expect(screen.getByText(/does not diagnose dengue/i)).toBeInTheDocument()
		expect(screen.getByText(/does not confirm mosquito breeding/i)).toBeInTheDocument()
	})

	it('uses an eager decorative hero and descriptive lazy-loaded instructional images', () => {
		renderLearnPage()

		const hero = screen.getByTestId('learn-hero-image')
		expect(hero).toHaveAttribute('alt', '')
		expect(hero).toHaveAttribute('loading', 'eager')
		expect(hero).toHaveAttribute('fetchpriority', 'high')
		expect(hero).toHaveAttribute('width')
		expect(hero).toHaveAttribute('height')

		const guideImages = screen.getAllByRole('img')
		expect(guideImages).toHaveLength(4)
		guideImages.forEach((image) => {
			expect(image).toHaveAttribute('loading', 'lazy')
			expect(image).toHaveAttribute('decoding', 'async')
			expect(image.getAttribute('alt')).not.toBe('')
			expect(image).toHaveAttribute('width')
			expect(image).toHaveAttribute('height')
		})
	})

	it('avoids unsupported categories, risk labels, medical advice, and action promises', () => {
		const { container } = renderLearnPage()
		const copy = container.textContent ?? ''

		expect(copy).not.toMatch(/300 eggs|100K\+|flight radius|seven habitats|7 habitats/i)
		expect(copy).not.toMatch(/flower pot trays|construction sites|roof gutters|tree holes/i)
		expect(copy).not.toMatch(/high risk|medium risk|low risk|risk detected/i)
		expect(copy).not.toMatch(/officer|inspection|field action|guaranteed action|verified breeding/i)
		expect(copy).not.toMatch(/symptom advice|medical treatment/i)
	})
})
