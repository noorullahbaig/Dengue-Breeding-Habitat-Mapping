import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useServices } from "@/app/useServices";
import {
	formatRelativeTime,
	formatHabitatLabel,
	formatConfidenceScore,
} from "@/lib/formatters";
import type { PublicHotspot, PublicMapReport } from "@/types/report";
import { StatusBadge } from "@/features/shared/StatusBadge";
import { ButtonLink, MetaLabel, Surface } from "@/components/ui";

export function ResidentHomeExperienceV2() {
	const { mapService } = useServices();
	const [reports, setReports] = useState<PublicMapReport[]>([]);
	const [hotspots, setHotspots] = useState<PublicHotspot[]>([]);

	useEffect(() => {
		let isMounted = true;

		Promise.allSettled([
			mapService.listPublicReports(),
			mapService.listHotspots(),
		]).then(([reportsResult, hotspotsResult]) => {
			if (!isMounted) {
				return;
			}

			if (reportsResult.status === "fulfilled") {
				setReports(reportsResult.value);
			} else {
				console.error("Failed to load public reports:", reportsResult.reason);
			}

			if (hotspotsResult.status === "fulfilled") {
				setHotspots(hotspotsResult.value);
			} else {
				console.error("Failed to load hotspots:", hotspotsResult.reason);
			}
		});

		return () => {
			isMounted = false;
		};
	}, [mapService]);

	const recentReports = reports.slice(0, 3);
	const resolvedReports = reports.filter(
		(report) => report.status === "closed",
	).length;

	return (
		<div className="page-layout page--resident-home">
			{/* Hero */}
			<Surface as="section" className="home-hero">
				<div className="home-hero__copy">
					<MetaLabel>Resident Reporting</MetaLabel>
					<h1 className="home-hero__title">Keep KL safe from dengue.</h1>
					<p className="home-hero__description">
						Spot a mosquito breeding site? Report it in under 2 minutes. Your
						anonymous report goes directly to KL vector control officers.
					</p>
					<div className="home-hero__actions">
						<ButtonLink to="/report" variant="primary">
							Start a report
						</ButtonLink>
						<ButtonLink to="/status" variant="ghost">
							Track a report
						</ButtonLink>
					</div>
				</div>
				{/* Hero visual — desktop only */}
				<div className="home-hero__visual home-hero__visual--desktop-only" aria-hidden="true">
					<div className="home-hero__visual-frame">
						<div className="home-hero__mesh-bg" />
						<div className="home-hero__shield-container">
							<svg
								className="home-hero__shield"
								viewBox="0 0 100 100"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
								role="img"
							>
								<title>DengueWatch KL Shield</title>
								<path
									d="M50 88C50 88 82 72 82 46V22L50 10L18 22V46C18 72 50 88 50 88Z"
									fill="url(#shield-grad)"
									stroke="var(--color-accent)"
									strokeWidth="3"
									strokeLinejoin="round"
								/>
								<path
									d="M50 78C50 78 74 65 74 46V27.5L50 18.5L26 27.5V46C26 65 50 78 50 78Z"
									fill="rgba(255, 255, 255, 0.15)"
									stroke="var(--color-accent-soft)"
									strokeWidth="1.5"
									strokeDasharray="3 3"
								/>
								<circle
									cx="50"
									cy="46"
									r="16"
									stroke="var(--color-accent)"
									strokeWidth="2"
									className="shield-pulse"
								/>
								<circle cx="50" cy="46" r="8" fill="var(--color-accent)" />
								<defs>
									<linearGradient
										id="shield-grad"
										x1="50"
										y1="10"
										x2="50"
										y2="88"
										gradientUnits="userSpaceOnUse"
									>
										<stop stopColor="rgba(216, 242, 255, 0.95)" />
										<stop offset="1" stopColor="rgba(255, 255, 255, 0.96)" />
									</linearGradient>
								</defs>
							</svg>
						</div>
					</div>
					<div className="home-hero__steps">
						<ol className="home-guidance__list">
							<li>
								<strong>Photo of the habitat</strong>
								<span>
									Clear evidence helps officers validate the site quickly.
								</span>
							</li>
							<li>
								<strong>Location confirmation</strong>
								<span>
									Use browser GPS, then refine the exact point on the map.
								</span>
							</li>
							<li>
								<strong>Consent and final review</strong>
								<span>
									Choose public visibility explicitly before the report is
									submitted.
								</span>
							</li>
						</ol>
					</div>
				</div>
			</Surface>

			{/* Stats Row */}
			<div className="home-stats-row">
				<div className="home-stat-tile">
					<span className="home-stat-tile__value">{reports.length}</span>
					<span className="home-stat-tile__label">Habitats reported</span>
				</div>
				<div className="home-stat-tile">
					<span className="home-stat-tile__value">{resolvedReports}</span>
					<span className="home-stat-tile__label">Sites resolved</span>
				</div>
				<div className="home-stat-tile home-stat-tile--accent">
					<span className="home-stat-tile__value">{hotspots.length}</span>
					<span className="home-stat-tile__label">Active outbreaks</span>
				</div>
			</div>

			{/* Recent Activity */}
			<section className="home-activity">
				<div className="home-activity__header">
					<div>
						<MetaLabel>Community</MetaLabel>
						<h2>Recent public reports</h2>
					</div>
					<Link to="/map" className="home-activity__header-link">
						<span>Open map</span>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<line x1="5" y1="12" x2="19" y2="12" />
							<polyline points="12 5 19 12 12 19" />
						</svg>
					</Link>
				</div>
				<div className="home-activity__list">
					{recentReports.map((report) => (
						<Link
							key={report.id}
							to={`/map/reports/${report.reference}`}
							className="activity-card"
							aria-label={`View details for ${formatHabitatLabel(report.habitatClass)} reported in ${report.neighborhood}`}
						>
							<div className="activity-card__image-container">
								<img
									src={report.thumbnailUrl}
									alt=""
									className="activity-card__image"
									onError={(e) => {
										e.currentTarget.src =
											'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="%2300464f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="15" y="15" width="70" height="70" rx="8" fill="%23d8f2ff"/%3E%3Cpath d="M15 65l20-20 25 25 10-10 15 15"/%3E%3Ccircle cx="40" cy="40" r="8" fill="%2300464f"/%3E%3C/svg%3E';
									}}
								/>
								{report.prediction?.confidence ? (
									<div className="activity-card__confidence-badge">
										{formatConfidenceScore(report.prediction.confidence)}
									</div>
								) : null}
							</div>
							<div className="activity-card__details">
								<span className="activity-card__neighborhood">
									{report.neighborhood}
								</span>
								<h3 className="activity-card__title">
									{formatHabitatLabel(report.habitatClass)} Detected
								</h3>
								<div className="activity-card__badges">
									<StatusBadge status={report.status} />
									{report.reportCount > 1 ? (
										<span className="activity-card__stack-count">
											{report.reportCount} reports
										</span>
									) : null}
									<span className="activity-card__time">
										{formatRelativeTime(report.latestReportedAt)}
									</span>
								</div>
							</div>
							<div className="activity-card__arrow">
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<polyline points="9 18 15 12 9 6" />
								</svg>
							</div>
						</Link>
					))}
					{recentReports.length === 0 ? (
						<div className="activity-card activity-card--empty">
							<div className="activity-card__empty-icon">
								<svg
									width="32"
									height="32"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
									<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
									<line x1="12" y1="22.08" x2="12" y2="12" />
								</svg>
							</div>
							<div className="activity-card__details">
								<h3 className="activity-card__title">No active reports listed</h3>
								<p className="activity-card__sub">
									Be the first to report a site in your area.
								</p>
							</div>
						</div>
					) : null}
				</div>
			</section>
		</div>
	);
}
