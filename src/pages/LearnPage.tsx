import {
	Camera,
	Check,
	CircleAlert,
	ExternalLink,
	Eye,
	FileCheck2,
	ImageOff,
	MapPin,
	MapPinned,
	ScanSearch,
	ShieldAlert,
} from 'lucide-react'
import heroImage from '@/assets/learn/learn-route-hero.webp'
import clearPhotoImage from '@/assets/learn/photo-clear.webp'
import { ButtonLink } from '@/components/ui'
import {
	difficultPhotoCues,
	habitatGuides,
	heroStats,
	processingSteps,
	reportChecklist,
	reportSteps,
	usefulPhotoCues,
} from '@/pages/learn/learnContent'

const processIcons = [ScanSearch, Check, FileCheck2, MapPinned] as const

function FinalActions() {
	return (
		<div className="learn-actions">
			<ButtonLink to="/report" size="large" fullWidth>
				Start report
			</ButtonLink>
			<ButtonLink to="/map" variant="secondary" size="large" fullWidth>
				View map
			</ButtonLink>
		</div>
	)
}

export function LearnPage() {
	return (
		<article className="learn-page">
			<section
				className="learn-problem"
				data-learn-section="problem"
				aria-labelledby="learn-title"
			>
				<figure className="learn-problem__visual">
					<img
						src={heroImage}
						alt=""
						width="1536"
						height="1024"
						loading="eager"
						fetchPriority="high"
						decoding="async"
						data-testid="learn-hero-image"
					/>
				</figure>

				<div className="learn-problem__body">
					<p className="learn-problem__label">Dengue in perspective</p>
					<h1 id="learn-title">Dengue is a growing threat, and prevention starts close to home.</h1>
					<p className="learn-problem__lead">
						Aedes mosquitoes breed in water-holding places near homes and streets. Learning what to spot is a practical first step.
					</p>

					<ul className="learn-stat-list" aria-label="Dengue statistics">
						{heroStats.map((stat) => (
							<li className="learn-stat" key={`${stat.value}-${stat.label}`}>
								<strong>{stat.value}</strong>
								<span>{stat.label}</span>
								<span className="learn-stat__source">
									<a href={stat.sourceUrl} target="_blank" rel="noreferrer">
										{stat.sourceLabel}<ExternalLink size={12} aria-hidden="true" />
									</a>
									{stat.asOf ? ` · ${stat.asOf}` : null}
								</span>
							</li>
						))}
					</ul>

					<div className="learn-problem__actions">
						<a
							href="#recognise"
							className="ui-button ui-button--primary ui-button--large ui-button--full"
						>
							Learn what to look for
						</a>
						<ButtonLink to="/map" variant="secondary" size="large" fullWidth>
							View dengue map
						</ButtonLink>
					</div>
				</div>
			</section>

			<section
				id="recognise"
				className="learn-chapter learn-habitats"
				data-learn-section="habitats"
				aria-labelledby="learn-habitats-title"
			>
				<header className="learn-chapter__header">
					<p className="learn-chapter__number">01 Recognise the habitat</p>
					<h2 id="learn-habitats-title">Breeding sites can look ordinary</h2>
					<p>Learn the three water-holding site types DengueWatch can categorise.</p>
				</header>

				<div className="learn-habitat-list">
					{habitatGuides.map((habitat) => (
						<article className="learn-habitat" data-habitat={habitat.id} key={habitat.id}>
							<figure className="learn-habitat__visual">
								<img
									src={habitat.image}
									alt={habitat.imageAlt}
									width="960"
									height="720"
									loading="lazy"
									decoding="async"
								/>
							</figure>
							<div className="learn-habitat__body">
								<h3>{habitat.title}</h3>
								<p>{habitat.description}</p>
								<ul className="learn-cue-list">
									{habitat.cues.map((cue) => (
										<li key={cue}><Check size={17} aria-hidden="true" />{cue}</li>
									))}
								</ul>
							</div>
						</article>
					))}
				</div>

				<aside className="learn-accuracy-note" aria-label="Identification limitation">
					<Eye size={21} aria-hidden="true" />
					<p>A photo can document a possible water-holding site, but it cannot confirm mosquito breeding.</p>
				</aside>
			</section>

			<section
				className="learn-chapter learn-action-chapter"
				data-learn-section="action"
				aria-labelledby="learn-action-title"
			>
				<header className="learn-chapter__header">
					<p className="learn-chapter__number">02 Take safe action</p>
					<h2 id="learn-action-title">Found a possible site? Report it safely.</h2>
					<p>Report a visible site only when it is safe to photograph.</p>
				</header>

				<aside className="learn-safety" aria-label="Reporting safety">
					<ShieldAlert size={24} aria-hidden="true" />
					<p><strong>Keep a safe distance.</strong> Do not enter drains, traffic, restricted property, construction areas, or any unsafe location.</p>
				</aside>

				<ul className="learn-report-checklist">
					{reportChecklist.map((item) => (
						<li key={item}><Check size={18} aria-hidden="true" />{item}</li>
					))}
				</ul>

				<ButtonLink to="/report" size="large" fullWidth>
					Start report
				</ButtonLink>
			</section>

			<section
				className="learn-chapter learn-evidence"
				data-learn-section="evidence"
				aria-labelledby="learn-evidence-title"
			>
				<header className="learn-chapter__header">
					<h2 id="learn-evidence-title">A useful report shows the site, not just the water</h2>
					<p>Show enough visual and location context to understand the site.</p>
				</header>

				<div className="learn-evidence-example">
					<figure className="learn-evidence-photo">
						<img
							src={clearPhotoImage}
							alt="Blocked drain, standing water, and surrounding street shown clearly in one frame."
							width="720"
							height="540"
							loading="lazy"
							decoding="async"
						/>
						<figcaption><Camera size={19} aria-hidden="true" />A clear, useful view</figcaption>
					</figure>

					<ul className="learn-photo-cues">
						{usefulPhotoCues.map((cue) => (
							<li data-instructional key={cue}><Check size={18} aria-hidden="true" />{cue}</li>
						))}
					</ul>

					<aside className="learn-avoid" aria-label="Photo problems to avoid">
						<div><ImageOff size={20} aria-hidden="true" /><strong>Avoid</strong></div>
						<ul>
							{difficultPhotoCues.map((cue) => <li data-instructional key={cue}>{cue}</li>)}
						</ul>
					</aside>
				</div>

				<ol className="learn-report-steps">
					{reportSteps.map((step, index) => (
						<li key={step.title}>
							<span aria-hidden="true">{index + 1}</span>
							<div><h3>{step.title}</h3><p>{step.description}</p></div>
						</li>
					))}
				</ol>
			</section>

			<section
				className="learn-platform"
				data-learn-section="platform"
				aria-labelledby="learn-platform-title"
			>
				<header className="learn-platform-intro">
					<p>From your report to public context</p>
					<h2 id="learn-platform-title">How DengueWatch helps</h2>
					<span>Your report becomes structured information for tracking and the public map.</span>
				</header>

				<ol className="learn-process">
					{processingSteps.map((step, index) => {
						const Icon = processIcons[index]
						return (
							<li key={step.title}>
								<span className="learn-process__icon" aria-hidden="true"><Icon size={19} /></span>
								<div><h3>{step.title}</h3><p>{step.description}</p></div>
							</li>
						)
					})}
				</ol>
			</section>

			<section
				className="learn-final"
				data-learn-section="final"
				aria-labelledby="learn-final-title"
			>
				<div className="learn-final__notice">
					<CircleAlert size={24} aria-hidden="true" />
					<div>
						<h2 id="learn-final-title">Important to know</h2>
						<p>DengueWatch records environmental conditions. It does not diagnose dengue and does not confirm mosquito breeding at a specific site.</p>
					</div>
				</div>
				<div className="learn-final__cta">
					<MapPin size={22} aria-hidden="true" />
					<div><h3>Ready to document a possible site?</h3><p>Take a clear photo, confirm the location, and submit the report.</p></div>
				</div>
				<FinalActions />
			</section>
		</article>
	)
}
