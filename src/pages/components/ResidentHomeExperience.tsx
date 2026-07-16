import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, LocateFixed, ShieldCheck } from "lucide-react";
import { useServices } from "@/app/useServices";
import {
	formatRelativeTime,
	formatHabitatLabel,
	formatConfidenceScore,
} from "@/lib/formatters";
import type { PublicHotspot, PublicMapReport } from "@/types/report";
import { StatusBadge } from "@/features/shared/StatusBadge";
import { ButtonLink, MetaLabel } from "@/components/ui";
import heroImage from "@/assets/home/klcc-reporting-hero.webp";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function countReportsSubmittedWithinDays(
	reports: PublicMapReport[],
	days: number,
	now = Date.now(),
) {
	const windowStart = now - days * DAY_IN_MILLISECONDS;

	return reports.filter((report) => {
		const submittedAt = new Date(report.reportedAt).getTime();
		return submittedAt >= windowStart && submittedAt <= now;
	}).length;
}

export function ResidentHomeExperience() {
	const { mapService } = useServices();
	const [reports, setReports] = useState<PublicMapReport[]>([]);
	const [hotspots, setHotspots] = useState<PublicHotspot[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [reportsError, setReportsError] = useState(false);
	const [hotspotsError, setHotspotsError] = useState(false);

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
				setReportsError(true);
				console.error("Failed to load public reports:", reportsResult.reason);
			}

			if (hotspotsResult.status === "fulfilled") {
				setHotspots(hotspotsResult.value);
			} else {
				setHotspotsError(true);
				console.error("Failed to load hotspots:", hotspotsResult.reason);
			}

			setIsLoading(false);
		});

		return () => {
			isMounted = false;
		};
	}, [mapService]);

	const recentReports = [...reports]
		.sort(
			(a, b) =>
				new Date(b.latestReportedAt).getTime() -
				new Date(a.latestReportedAt).getTime(),
		)
		.slice(0, 3);
	const reportsSubmittedWithinSevenDays = countReportsSubmittedWithinDays(
		reports,
		7,
	);

	return (
		<div className="page-layout page--resident-home">
			<section className="home-hero" aria-labelledby="home-hero-title">
				<div className="home-hero__copy">
					<span className="home-hero__context">
						Kuala Lumpur resident reporting
					</span>
					<h1 id="home-hero-title" className="home-hero__title">
						Report a dengue breeding site.
					</h1>
					<p className="home-hero__description">
						Send a clear photo and confirm the exact location. It takes about
						two minutes and does not require an account.
					</p>
					<div className="home-hero__actions">
						<ButtonLink to="/report" variant="secondary" size="large">
							Start a report
						</ButtonLink>
						<ButtonLink to="/status" variant="ghost" size="large">
							Track a report
						</ButtonLink>
					</div>
					<Link to="/learn" className="home-hero__learn-link">
						Learn what to report
						<ArrowRight size={16} aria-hidden="true" />
					</Link>
				</div>
				<div className="home-hero__visual" aria-hidden="true">
					<img src={heroImage} alt="" className="home-hero__image" />
					<div className="home-hero__image-note">
						<span>Clear evidence</span>
						<span>Exact location</span>
						<span>Trackable reference</span>
					</div>
				</div>
			</section>

			<section
				className="home-readiness"
				aria-labelledby="home-readiness-title"
			>
				<div className="home-readiness__intro">
					<h2 id="home-readiness-title">Ready when you are</h2>
					<p>Bring the essentials. The report flow guides the rest.</p>
				</div>
				<ul className="home-readiness__list">
					<li>
						<Camera size={18} aria-hidden="true" />
						<strong>Clear photo</strong>
					</li>
					<li>
						<LocateFixed size={18} aria-hidden="true" />
						<strong>Location check</strong>
					</li>
					<li>
						<ShieldCheck size={18} aria-hidden="true" />
						<strong>No account required</strong>
					</li>
				</ul>
				<div className="home-readiness__learn">
					<span>Not sure what counts as a breeding site?</span>
					<Link to="/learn">
						Explore common breeding habitats{" "}
						<ArrowRight size={16} aria-hidden="true" />
					</Link>
				</div>
			</section>

			{!isLoading && reportsError && hotspotsError ? (
				<div className="home-live-alert" role="status">
					<strong>Live KL context is temporarily unavailable.</strong>
					<span>Reporting and reference-code tracking remain available.</span>
				</div>
			) : null}

			<section
				className="home-stats-row"
				aria-label="Kuala Lumpur public-health summary"
			>
				<div className="home-stat-tile">
					<strong
						className="home-stat-tile__value"
						data-state={
							reportsError ? "unavailable" : isLoading ? "loading" : "ready"
						}
					>
						{isLoading ? "–" : reportsError ? "Unavailable" : reports.length}
					</strong>
					<span className="home-stat-tile__label">Public reports</span>
				</div>
				<div className="home-stat-tile">
					<strong
						className="home-stat-tile__value"
						data-state={
							reportsError ? "unavailable" : isLoading ? "loading" : "ready"
						}
					>
						{isLoading
							? "–"
							: reportsError
								? "Unavailable"
								: reportsSubmittedWithinSevenDays}
					</strong>
					<span className="home-stat-tile__label">Recent reports</span>
				</div>
				<div className="home-stat-tile home-stat-tile--accent">
					<strong
						className="home-stat-tile__value"
						data-state={
							hotspotsError ? "unavailable" : isLoading ? "loading" : "ready"
						}
					>
						{isLoading ? "–" : hotspotsError ? "Unavailable" : hotspots.length}
					</strong>
					<span className="home-stat-tile__label">Active hotspot areas</span>
				</div>
			</section>

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
					{isLoading ? (
						<div className="home-activity__loading" role="status">
							<span className="home-activity__loading-bar" />
							<span className="home-activity__loading-bar" />
							<span>Loading community reports…</span>
						</div>
					) : reportsError ? (
						<div className="home-activity__unavailable" role="status">
							<strong>Public reports are temporarily unavailable.</strong>
							<span>You can still start or track a report.</span>
						</div>
					) : (
						recentReports.map((report) => (
							<Link
								key={report.id}
								to={`/map/reports/${report.reference}`}
								className="activity-card"
								data-testid="home-report-link"
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
						))
					)}
					{!isLoading && !reportsError && recentReports.length === 0 ? (
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
								<h3 className="activity-card__title">No public reports yet</h3>
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
