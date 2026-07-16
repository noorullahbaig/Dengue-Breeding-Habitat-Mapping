import type { HabitatClass } from '@/types/report'
import habitatContainerImage from '@/assets/learn/habitat-container.webp'
import habitatDrainImage from '@/assets/learn/habitat-drain.webp'
import habitatTireImage from '@/assets/learn/habitat-tire.webp'

type SupportedHabitatClass = Exclude<HabitatClass, 'unclassified'>

export interface HeroStat {
	value: string
	label: string
	sourceLabel: string
	sourceUrl: string
	asOf?: string
}

export interface HabitatGuide {
	id: SupportedHabitatClass
	title: string
	description: string
	cues: readonly [string, string]
	image: string
	imageAlt: string
}

export interface GuideStep {
	title: string
	description: string
}

const WHO_DENGUE_SOURCE =
	'https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue'
const MALAYSIA_HEALTH_INDICATORS_SOURCE =
	'https://www.moh.gov.my/moh/resources/Penerbitan/Penerbitan%20Utama/HEALTH%20INDICATOR/PETUNJUK_KESIHATAN_2025.pdf'

export const heroStats: readonly HeroStat[] = [
	{
		value: '1 in 2',
		label: 'people worldwide are at risk of dengue',
		sourceLabel: 'WHO',
		sourceUrl: WHO_DENGUE_SOURCE,
	},
	{
		value: '100–400M',
		label: 'estimated dengue infections each year',
		sourceLabel: 'WHO',
		sourceUrl: WHO_DENGUE_SOURCE,
	},
	{
		value: '122,423',
		label: 'reported Malaysian dengue cases',
		sourceLabel: 'KKM',
		sourceUrl: MALAYSIA_HEALTH_INDICATORS_SOURCE,
		asOf: 'Full-year 2024',
	},
] as const

export const habitatGuides: readonly HabitatGuide[] = [
	{
		id: 'tire',
		title: 'Tires',
		description: 'Discarded tires can trap rainwater inside their curved rims when left uncovered.',
		cues: ['Water pooled inside the rim', 'Discarded or stacked tires outdoors'],
		image: habitatTireImage,
		imageAlt: 'Discarded tire holding rainwater beside a Kuala Lumpur street.',
	},
	{
		id: 'drain_inlet',
		title: 'Drain inlets',
		description: 'Leaves or rubbish can block water flow and leave stagnant pools around a drain inlet.',
		cues: ['Debris blocking the grate', 'Water remaining around the inlet'],
		image: habitatDrainImage,
		imageAlt: 'Blocked roadside drain inlet with leaves and water remaining inside.',
	},
	{
		id: 'artificial_container',
		title: 'Artificial containers',
		description: 'Buckets, bottles, cans, and trays can collect rainwater when left open outdoors.',
		cues: ['An opening exposed to rain', 'Visible water held inside'],
		image: habitatContainerImage,
		imageAlt: 'Open bucket, bottle, can, and tray collecting water outdoors.',
	},
] as const

export const reportChecklist = [
	'Water remains in an object or drain.',
	'The site is outdoors and publicly visible.',
	'The object matches a supported category.',
	'The site is in Kuala Lumpur and safe to photograph.',
] as const

export const usefulPhotoCues = [
	'Show the whole object',
	'Show the water-holding area',
	'Include surrounding context',
] as const

export const difficultPhotoCues = [
	'Only the water surface is visible',
	'The image is dark or blurred',
	'The object cannot be identified',
] as const

export const reportSteps: readonly GuideStep[] = [
	{
		title: 'Take one clear photo',
		description: 'Frame the object and enough of its surroundings to understand the site.',
	},
	{
		title: 'Confirm this exact site',
		description: 'Move the map marker when needed, then confirm the precise location.',
	},
	{
		title: 'Review consent and submit',
		description: 'Approve sharing the public image and exact map pin before submission.',
	},
] as const

export const processingSteps: readonly GuideStep[] = [
	{
		title: 'Category advisory',
		description: 'The photo category advisory runs before final submission.',
	},
	{
		title: 'You confirm and submit',
		description: 'You check the category, location, and consent before sending the report.',
	},
	{
		title: 'Report record created',
		description: 'The photo, confirmed location, capture time, and category are stored together.',
	},
	{
		title: 'Area context added',
		description: 'Current iDengue hotspot context, a tracking reference, and a public-map record are added.',
	},
] as const
