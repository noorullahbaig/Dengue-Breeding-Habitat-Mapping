import { useState } from "react";
import { Surface, ButtonLink } from "@/components/ui";
import {
	ChevronDown,
	ChevronUp,
	Camera,
	AlertTriangle,
} from "lucide-react";

type RiskLevel = "high" | "medium" | "low";

interface Habitat {
	id: string;
	title: string;
	tagline: string;
	risk: RiskLevel;
	visualCues: string[];
	whyDangerous: string;
	photoTip: string;
}

const habitats: Habitat[] = [
	{
		id: "tires",
		title: "Discarded Tires",
		tagline: "Dark, warm water — ideal for larvae",
		risk: "high",
		visualCues: [
			"Round rubber rim with water pooled inside",
			"Dark or oily-looking water trapped in the cavity",
			"Found in backyards, workshops, roadsides, dumping grounds",
		],
		whyDangerous:
			"Tires hold warm, shaded water that is nearly impossible to drain naturally. A single tire can sustain hundreds of larvae through multiple generations, making them one of the most impactful breeding sites in urban areas.",
		photoTip:
			"Photograph the interior of the rim clearly. Show that water is present inside.",
	},
	{
		id: "drains",
		title: "Clogged Drains",
		tagline: "Stagnant pools hiding in plain sight",
		risk: "high",
		visualCues: [
			"Leaf and debris buildup blocking the drain grate",
			"Visible dark or greenish stagnant water",
			"Algae growth on drain walls or edges",
		],
		whyDangerous:
			"Blocked drains convert flowing water into long-standing stagnant pools right beside homes and walkways. They are among the most common sources of urban dengue outbreaks in KL.",
		photoTip:
			"Stand above the drain and photograph showing both the blockage and visible water.",
	},
	{
		id: "flower-trays",
		title: "Flower Pot Trays",
		tagline: "The most overlooked indoor hazard",
		risk: "medium",
		visualCues: [
			"Plastic or ceramic tray sitting under a pot",
			"Visible water with a dark evaporation ring stain",
			"Common on balconies, corridors, window ledges",
		],
		whyDangerous:
			"Flower trays are watered regularly and then forgotten. Even a thin film of water left for 4 days is enough for a complete breeding cycle — indoors, sheltered from rain and sunlight, making this the most underreported hazard.",
		photoTip:
			"Look under and around each pot. Photograph the tray clearly showing any standing water.",
	},
	{
		id: "containers",
		title: "Open Containers",
		tagline: "Any vessel that holds an inch of water",
		risk: "medium",
		visualCues: [
			"Uncovered buckets, drums, pails, bottles, or cans",
			"Rainwater or stored water visible inside",
			"Often found alongside houses, in gardens, or storage areas",
		],
		whyDangerous:
			"Open containers collect fresh rainwater and can sustain repeated breeding cycles for weeks. They refill automatically and are often forgotten until a dengue case is reported nearby.",
		photoTip:
			"Photograph the container from above showing it is open and contains standing water.",
	},
	{
		id: "construction",
		title: "Construction Sites",
		tagline: "Multiple breeding sites, zero monitoring",
		risk: "medium",
		visualCues: [
			"Water pooled in tarpaulin folds or excavation pits",
			"Wheel ruts, formwork, or scaffolding holding water",
			"Unused equipment or containers left uncovered",
		],
		whyDangerous:
			"Construction sites create numerous simultaneous water collection points that go unmonitored for days at a time. Workers and nearby residents are all at elevated risk.",
		photoTip:
			"You can report from the perimeter. Show the site context and any visible stagnant pools.",
	},
	{
		id: "gutters",
		title: "Roof Gutters & Downpipes",
		tagline: "Overhead hazards above where you sleep",
		risk: "medium",
		visualCues: [
			"Sagging gutter sections visibly holding debris",
			"Dark staining along the gutter line",
			"Leaf litter or green algae visible from below",
		],
		whyDangerous:
			"Clogged gutters create continuous water channels just metres above living spaces. Mosquitoes that emerge here are immediately adjacent to sleeping areas, dramatically shortening their travel distance to bite.",
		photoTip:
			"From ground level, frame the roofline showing where the gutter sags or is visibly blocked.",
	},
	{
		id: "tree-holes",
		title: "Tree Holes & Bamboo",
		tagline: "Natural containers in parks and green areas",
		risk: "low",
		visualCues: [
			"Cavities in tree trunks or stumps holding water",
			"Hollow bamboo internodes open to the sky",
			"Dark standing water visible inside the natural cavity",
		],
		whyDangerous:
			"While less common in dense urban KL, natural containers in parks and gardens can breed mosquitoes that travel into nearby housing. Worth reporting wherever observed near residential areas.",
		photoTip:
			"Focus on the cavity opening itself, showing water clearly inside.",
	},
];

const dengueStats = [
	{ value: "300", unit: "eggs", label: "per female, per sitting" },
	{ value: "4", unit: "days", label: "egg to flying adult" },
	{ value: "100m", unit: "range", label: "Aedes mosquito flight radius" },
	{ value: "100K+", unit: "cases", label: "recorded yearly in Malaysia" },
];

const reportingSteps = [
	{
		step: "1",
		title: "Spot the Habitat",
		desc: "Look for stagnant water, blocked containers, or clogged drains near your home, street, or workplace.",
	},
	{
		step: "2",
		title: "Take a Clear Photo",
		desc: "Photograph the habitat from close range. Show the water and its container clearly — better photos get triaged faster.",
	},
	{
		step: "3",
		title: "Confirm Your Pin",
		desc: "In the Report tab, drag the map pin to the exact GPS location you consent to publish.",
	},
	{
		step: "4",
		title: "Submit Anonymously",
		desc: "AI analyzes your photo for habitat classification before the report is added to the public evidence map.",
	},
	{
		step: "5",
		title: "Track Your Impact",
		desc: "Use the reference code in the Track tab to follow the review status and see when field action is recorded.",
	},
];

const riskConfig: Record<
	RiskLevel,
	{ label: string; bg: string; color: string; border: string }
> = {
	high: {
		label: "High Risk",
		bg: "var(--semantic-danger-bg)",
		color: "var(--semantic-danger-text)",
		border: "var(--semantic-danger-border)",
	},
	medium: {
		label: "Medium Risk",
		bg: "var(--semantic-warning-bg)",
		color: "var(--semantic-warning-text)",
		border: "var(--semantic-warning-border)",
	},
	low: {
		label: "Low Risk",
		bg: "var(--semantic-info-bg)",
		color: "var(--semantic-info-text)",
		border: "var(--semantic-info-border)",
	},
};

export function LearnPage() {
	const [activeCard, setActiveCard] = useState<string | null>(null);

	function toggleCard(id: string) {
		setActiveCard((prev) => (prev === id ? null : id));
	}

	return (
		<div className="lv2-page">
			{/* ── Hero ── */}
			<Surface as="section" className="lv2-hero">
				<div className="lv2-hero__eyebrow">
					<span className="lv2-hero__eyebrow-pulse" aria-hidden="true" />
					Habitat Intelligence Guide
				</div>
				<h1 className="lv2-hero__title">Know what you're looking&nbsp;for.</h1>
				<p className="lv2-hero__subtitle">
					Dengue mosquitoes don't breed in rivers or lakes — they breed in
					small, stagnant water you walk past every day. Learn to recognize the
					7 site types that matter most in Kuala Lumpur.
				</p>
				<div className="lv2-hero__actions">
					<ButtonLink to="/report">
						Start Reporting
					</ButtonLink>
					<ButtonLink to="/map" variant="ghost">
						See the live map
					</ButtonLink>
				</div>
			</Surface>

			{/* ── Dengue Impact Stats ── */}
			<Surface
				as="section"
				padding="none"
				className="lv2-stats-strip"
				aria-label="Dengue impact statistics"
			>
				{dengueStats.map((stat) => (
					<div key={stat.label} className="lv2-stat">
						<div className="lv2-stat__value">
							{stat.value}
							<span className="lv2-stat__unit">{stat.unit}</span>
						</div>
						<div className="lv2-stat__label">{stat.label}</div>
					</div>
				))}
			</Surface>

			{/* ── Habitat Explorer ── */}
			<section className="lv2-section">
				<header className="lv2-section__header">
					<div className="lv2-section__eyebrow">Interactive Explorer</div>
					<h2 className="lv2-section__title">The 7 habitats to know</h2>
					<p className="lv2-section__desc">
						Tap any habitat to reveal visual identification cues, why it's
						dangerous, and a photo tip for your report.
					</p>
				</header>

				<ul className="lv2-habitats">
					{habitats.map((habitat) => {
						const isActive = activeCard === habitat.id;
						return (
							<li
								key={habitat.id}
								className={`lv2-habitat-card${isActive ? " lv2-habitat-card--active" : ""}`}
							>
								<button
									type="button"
									className="lv2-habitat-card__trigger"
									onClick={() => toggleCard(habitat.id)}
									aria-expanded={isActive}
									aria-controls={`habitat-body-${habitat.id}`}
									id={`habitat-trigger-${habitat.id}`}
								>
									<div className="lv2-habitat-card__left">
										<div className="lv2-habitat-card__meta">
											<div className="lv2-habitat-card__title">
												{habitat.title}
											</div>
											<div className="lv2-habitat-card__tagline">
												{habitat.tagline}
											</div>
										</div>
									</div>
									<div className="lv2-habitat-card__right">
										<span
											className="lv2-risk-badge"
											data-risk={habitat.risk}
											style={{
												backgroundColor: riskConfig[habitat.risk].bg,
												color: riskConfig[habitat.risk].color,
												borderColor: riskConfig[habitat.risk].border,
											}}
										>
											{riskConfig[habitat.risk].label}
										</span>
										<span
											className="lv2-habitat-card__chevron"
											aria-hidden="true"
										>
											{isActive ? (
												<ChevronUp size={18} />
											) : (
												<ChevronDown size={18} />
											)}
										</span>
									</div>
								</button>

								{isActive && (
									<section
										className="lv2-habitat-card__body"
										id={`habitat-body-${habitat.id}`}
										aria-labelledby={`habitat-trigger-${habitat.id}`}
									>
										<div className="lv2-habitat-card__why">
											<AlertTriangle
												size={15}
												className="lv2-habitat-card__why-icon"
												aria-hidden="true"
											/>
											<p>{habitat.whyDangerous}</p>
										</div>

										<div className="lv2-habitat-card__cues">
											<div className="lv2-habitat-card__cues-label">
												Visual identification cues
											</div>
											<ul className="lv2-habitat-card__cues-list">
												{habitat.visualCues.map((cue) => (
													<li key={cue}>{cue}</li>
												))}
											</ul>
										</div>

										<div className="lv2-habitat-card__photo-tip">
											<Camera size={13} aria-hidden="true" />
											<span>
												<strong>Photo tip:</strong> {habitat.photoTip}
											</span>
										</div>

										<div>
											<ButtonLink
												to="/report"
												variant="secondary"
												aria-label={`Report a ${habitat.title} habitat`}
											>
												Report this habitat →
											</ButtonLink>
										</div>
									</section>
								)}
							</li>
						);
					})}
				</ul>
			</section>

			{/* ── Reporting Steps ── */}
			<section className="lv2-section">
				<header className="lv2-section__header">
					<div className="lv2-section__eyebrow">How It Works</div>
					<h2 className="lv2-section__title">Report in 5 steps</h2>
					<p className="lv2-section__desc">
						The entire process takes under 2 minutes. Here's exactly what
						happens from spot to action.
					</p>
				</header>

				<Surface className="lv2-steps">
					{reportingSteps.map((step, i) => {
						const isLast = i === reportingSteps.length - 1;
						return (
							<div key={step.step} className="lv2-step">
								<div className="lv2-step__track">
									<div className="lv2-step__icon-wrap">
										{step.step}
									</div>
									{!isLast && (
										<div className="lv2-step__connector" aria-hidden="true" />
									)}
								</div>
								<div className="lv2-step__content">
									<h3 className="lv2-step__title">{step.title}</h3>
									<p className="lv2-step__desc">{step.desc}</p>
								</div>
							</div>
						);
					})}
				</Surface>
			</section>

			{/* ── CTA Banner ── */}
			<section className="lv2-cta" aria-label="Call to action">
				<div className="lv2-cta__badge">Your community needs you</div>
				<h2 className="lv2-cta__title">
					One report can stop an outbreak before it starts.
				</h2>
				<p className="lv2-cta__desc">
					Every habitat you flag contributes to the public evidence map for
					field verification and action. Anonymous. Free. Takes 2 minutes.
				</p>
				<div className="lv2-cta__actions">
					<ButtonLink to="/report">
						Report a Habitat Now
					</ButtonLink>
					<ButtonLink to="/map" variant="ghost">
						See active hotspots →
					</ButtonLink>
				</div>
			</section>
		</div>
	);
}
