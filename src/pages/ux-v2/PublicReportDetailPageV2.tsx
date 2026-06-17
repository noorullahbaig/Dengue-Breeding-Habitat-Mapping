import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useServices } from "@/app/useServices";
import { InlineNotice } from "@/components/InlineNotice";
import { StaticReceiptMap } from "@/pages/ux-v2/components/StaticReceiptMap";
import { StatusBadge } from "@/features/shared/StatusBadge";
import {
	formatCalendarDate,
	formatConfidenceLabel,
	formatHabitatLabel,
	formatTimestamp,
} from "@/lib/formatters";
import { PredictionEvidencePanelV2 } from "@/pages/ux-v2/components/PredictionEvidencePanelV2";
import type { PublicReportDetail } from "@/types/report";

export function PublicReportDetailPageV2() {
	const { reference = "" } = useParams();
	const { reportsService } = useServices();
	const [report, setReport] = useState<PublicReportDetail | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");
	const [selectedObsRef, setSelectedObsRef] = useState("");

	useEffect(() => {
		let isMounted = true;

		async function loadReport() {
			setIsLoading(true);
			setError("");

			try {
				const nextReport = await reportsService.getPublicReport(reference);
				if (isMounted) {
					setReport(nextReport);
					if (nextReport.observations && nextReport.observations.length > 0) {
						setSelectedObsRef(nextReport.observations[0].reference);
					} else {
						setSelectedObsRef(nextReport.reference);
					}
				}
			} catch (loadError) {
				if (isMounted) {
					setError(
						loadError instanceof Error &&
							loadError.message &&
							loadError.message !== "Failed to fetch"
							? loadError.message
							: "Public report details are temporarily unavailable.",
					);
					setReport(null);
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		void loadReport();

		return () => {
			isMounted = false;
		};
	}, [reference, reportsService]);

	// Get active observation data for display
	const activeObs = report?.observations?.find(
		(o) => o.reference === selectedObsRef,
	);

	// Build active prediction payload
	const activePrediction = activeObs
		? activeObs.prediction
		: report?.prediction;

	const activeImageUrl = activeObs ? activeObs.imageUrl : report?.imageUrl;

	return (
		<div className="page stack-md page--detail-revamp">
			{/* Premium Back Bar */}
			<div className="detail-navigation-bar">
				<Link to="/map" className="detail-back-link">
					<ArrowLeft size={18} />
					Back to Interactive Map
				</Link>
			</div>

			{isLoading ? (
				<div className="loading-state">Loading public report details...</div>
			) : null}
			{error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}

			{!isLoading && !error && !report ? (
				<div className="empty-state">
					<p>No public report found matching this reference code.</p>
				</div>
			) : null}

			{report ? (
				<div className="stack-md" style={{ gap: "1.5rem" }}>
					{/* Hero Header */}
					<header className="detail-hero-header glass-panel">
						<div className="detail-hero-header__main">
							<div className="detail-hero-header__meta">
								<span className="detail-hero-header__ref">
									{report.reference}
								</span>
								<StatusBadge status={report.status} />
							</div>
							<h1 className="detail-hero-header__locality">
								{report.neighborhood}
							</h1>
							<p className="detail-hero-header__eyebrow">
								Active Observation:{" "}
								<strong>
									{formatHabitatLabel(
										activeObs ? activeObs.habitatClass : report.habitatClass,
									)}
								</strong>
							</p>
						</div>
						<div className="detail-hero-header__stats">
							<div className="detail-hero-header__stat-item">
								<span className="detail-hero-header__stat-label">
									Stacked Reports
								</span>
								<span className="detail-hero-header__stat-value">
									{report.reportCount}
								</span>
							</div>
							<div className="detail-hero-header__stat-item">
								<span className="detail-hero-header__stat-label">
									Last Updated
								</span>
								<span
									className="detail-hero-header__stat-value"
									style={{ fontSize: "0.95rem" }}
								>
									{formatCalendarDate(report.latestReportedAt)}
								</span>
							</div>
						</div>
					</header>

					{/* Main Content Split Grid */}
					<div className="public-detail-layout">
						{/* Left Column: Image Panel + Interactive Timeline */}
						<div className="public-detail-column public-detail-column--primary stack-md">
							{/* AI Evidence Card */}
							<section className="public-detail-card-section glass-panel">
								<div className="public-detail-card-section__header">
									<h2>Computer Vision Evidence</h2>
									<p className="caption-text">
										Citizen verified evidence photo and AI classification
										boundaries
									</p>
								</div>

								{activeImageUrl && !activePrediction ? (
									<div className="plain-evidence-wrapper">
										<img
											src={activeImageUrl}
											alt={`Evidence for ${selectedObsRef}`}
											className="plain-evidence-img"
										/>
									</div>
								) : null}

								{activePrediction ? (
									<PredictionEvidencePanelV2
										prediction={activePrediction}
										imageUrl={activeImageUrl}
										imageAlt={`AI bounding boxes for ${selectedObsRef}`}
										compact
										showDetections
									/>
								) : null}
							</section>

							{/* Gallery Timeline */}
							<section className="public-detail-card-section glass-panel">
								<div className="public-detail-card-section__header">
									<h2>Observation Timeline</h2>
									<p className="caption-text">
										This location has {report.reportCount} stacked citizen
										submissions
									</p>
								</div>

								<div className="timeline-gallery-wrap">
									{report.observations.map((obs) => {
										const isSelected = selectedObsRef === obs.reference;
										return (
											<button
												type="button"
												key={obs.reference}
												className={`timeline-node${isSelected ? " timeline-node--active" : ""}`}
												onClick={() => setSelectedObsRef(obs.reference)}
											>
												<div className="timeline-card">
													<img
														src={obs.thumbnailUrl}
														alt=""
														className="timeline-card__img"
													/>
													<div className="timeline-card__info">
														<div className="timeline-card__info-header">
															<strong className="timeline-card__ref">
																{obs.reference}
															</strong>
															<span className="timeline-card__date">
																{formatTimestamp(obs.reportedAt)}
															</span>
														</div>
														<div className="timeline-card__details">
															<span className="timeline-card__detail-pill">
																Class:{" "}
																<strong>
																	{formatHabitatLabel(obs.habitatClass)}
																</strong>
															</span>
															<span className="timeline-card__detail-pill">
																Confidence:{" "}
																<strong>
																	{formatConfidenceLabel(obs.confidenceBand)}
																</strong>
															</span>
														</div>
													</div>
													{isSelected ? (
														<span className="timeline-card__badge">
															▶ ACTIVE
														</span>
													) : (
														<span className="timeline-card__action">
															Review
														</span>
													)}
												</div>
											</button>
										);
									})}
								</div>
							</section>
						</div>

						{/* Right Column: Spatial Map + Proximity Notice + Metadata Grid */}
						<div className="public-detail-column public-detail-column--secondary stack-md">
							{/* Spatial Context Card */}
							<section className="public-detail-card-section glass-panel">
								<div className="public-detail-card-section__header">
									<h2>Location Context</h2>
									<p className="caption-text">
										Privacy-consented citizen location coordinate pin
									</p>
								</div>

								<div className="compact-map-wrapper">
									<StaticReceiptMap location={report.publicLocation} />
								</div>

								{/* Outbreak Zone Alert */}
								{report.hotspotPriority &&
								(report.hotspotPriority.priorityLevel === "core" ||
									report.hotspotPriority.priorityLevel === "warning") ? (
									<div
										className={`detail-outbreak-alert detail-outbreak-alert--${report.hotspotPriority.priorityLevel}`}
									>
										<div className="detail-outbreak-alert__badge">
											Active Outbreak Alert
										</div>
										<p>
											This site is within the{" "}
											<strong>
												{report.hotspotPriority.priorityLevel === "core"
													? "Core Hotspot Zone (0-200m)"
													: "Warning Buffer Zone (200-400m)"}
											</strong>{" "}
											for active outbreak locality{" "}
											<strong>
												{report.hotspotPriority.nearestHotspotLocality}
											</strong>{" "}
											(
											{Math.round(
												report.hotspotPriority.nearestHotspotDistanceMeters ??
													0,
											)}
											m away).
										</p>
									</div>
								) : (
									<div className="detail-outbreak-alert detail-outbreak-alert--safe">
										<div className="detail-outbreak-alert__badge">
											Monitoring Zone
										</div>
										<p>
											No active iDengue outbreak hotspots recorded within 400m
											of this location.
										</p>
									</div>
								)}
							</section>

							{/* Metadata details grid */}
							<section className="public-detail-card-section glass-panel">
								<div className="public-detail-card-section__header">
									<h2>Report Metadata</h2>
								</div>

								<div className="detail-metadata-grid">
									<div className="detail-metadata-item">
										<span className="detail-metadata-label">
											First Reported
										</span>
										<strong className="detail-metadata-value">
											{formatTimestamp(report.reportedAt)}
										</strong>
									</div>
									<div className="detail-metadata-item">
										<span className="detail-metadata-label">Last Updated</span>
										<strong className="detail-metadata-value">
											{formatTimestamp(report.latestReportedAt)}
										</strong>
									</div>
									<div className="detail-metadata-item">
										<span className="detail-metadata-label">
											Primary Habitat
										</span>
										<strong className="detail-metadata-value">
											{formatHabitatLabel(report.habitatClass)}
										</strong>
									</div>
									<div className="detail-metadata-item">
										<span className="detail-metadata-label">
											Total Submissions
										</span>
										<strong className="detail-metadata-value">
											{report.reportCount} reports
										</strong>
									</div>
								</div>

								{report.privacyNote ? (
									<div className="detail-privacy-note">
										<span className="detail-metadata-label">
											Citizen Privacy Consent
										</span>
										<p>{report.privacyNote}</p>
									</div>
								) : null}
							</section>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
