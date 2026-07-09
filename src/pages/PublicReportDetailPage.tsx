import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useServices } from "@/app/useServices";
import { InlineNotice } from "@/components/InlineNotice";
import { StaticReceiptMap } from "@/pages/components/StaticReceiptMap";
import { StatusBadge } from "@/features/shared/StatusBadge";
import { Surface, ButtonLink, EmptyState, LoadingState } from "@/components/ui";
import {
	formatCalendarDate,
	formatConfidenceLabel,
	formatHabitatLabel,
	formatTimestamp,
} from "@/lib/formatters";
import { toPublicReportErrorMessage } from "@/lib/userFacingErrors";
import { PredictionEvidencePanel } from "@/pages/components/PredictionEvidencePanel";
import type { HotspotPriority, PublicReportDetail } from "@/types/report";

export function getPublicHotspotContext(priority?: HotspotPriority) {
	if (
		priority?.priorityLevel === "core" ||
		priority?.priorityLevel === "warning"
	) {
		return {
			state: "prioritized" as const,
			badge: "Prioritized report",
		};
	}

	return {
		state: "normal" as const,
		badge: "Normal report",
	};
}

export function PublicReportDetailPage() {
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
					console.error("Failed to load public report detail:", loadError);
					setError(toPublicReportErrorMessage(loadError));
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
	const observations = report?.observations ?? [];
	const activeObs = observations.find(
		(o) => o.reference === selectedObsRef,
	);

	// Build active prediction payload
	const activePrediction = activeObs
		? activeObs.prediction
		: report?.prediction;

	const activeImageUrl = activeObs ? activeObs.imageUrl : report?.imageUrl;
	const hotspotContext = getPublicHotspotContext(report?.hotspotPriority);

	return (
		<div className="page-layout page--detail-revamp">
			<div className="page-body stack-md">
				{/* Premium Back Bar */}
				<div className="detail-navigation-bar">
					<ButtonLink to="/map" variant="ghost" size="compact">
						<ArrowLeft size={18} />
						Back to map
					</ButtonLink>
				</div>

				{isLoading ? (
					<LoadingState label="Loading public report details..." />
				) : null}
				{error ? (
					<InlineNotice tone="warning">
						<strong>Report unavailable.</strong> {error}
					</InlineNotice>
				) : null}

				{!isLoading && !error && !report ? (
					<Surface>
						<EmptyState title="Report Not Found">
							<p>No public report found matching this reference code.</p>
						</EmptyState>
					</Surface>
				) : null}

			{report ? (
				<div className="stack-md u-static-64fe16d9">
					<Surface as="header" className="detail-hero-header">
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
								Selected habitat:{" "}
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
								<span className="detail-hero-header__stat-value u-static-000a3510">
									{formatCalendarDate(report.latestReportedAt)}
								</span>
							</div>
						</div>
					</Surface>

					<div className="public-detail-layout">
						{/* Left Column: Image Panel + Interactive Timeline */}
						<div className="public-detail-column public-detail-column--primary stack-md">
							{/* AI Evidence Card */}
							<Surface as="section" className="public-detail-card-section">
								<div className="public-detail-card-section__header">
									<h2>Evidence review</h2>
									<p className="caption-text">
										Submitted photo with model classification boundaries
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
									<PredictionEvidencePanel
										prediction={activePrediction}
										imageUrl={activeImageUrl}
										imageAlt={`AI bounding boxes for ${selectedObsRef}`}
										compact
								/>
								) : null}
							</Surface>

							{/* Gallery Timeline */}
							<Surface as="section" className="public-detail-card-section">
								<div className="public-detail-card-section__header">
									<h2>Observation history</h2>
									<p className="caption-text">
										This location has {report.reportCount} stacked citizen
										submissions
									</p>
								</div>

								<div className="timeline-gallery-wrap">
									{(observations.length > 0
										? observations
										: [
												{
													id: report.id,
													reference: report.reference,
													capturedAt: report.reportedAt,
													reportedAt: report.reportedAt,
													imageUrl: report.imageUrl,
													thumbnailUrl: report.thumbnailUrl,
													habitatClass: report.habitatClass,
													confidenceBand: report.prediction.confidenceBand,
													prediction: report.prediction,
												},
											]
									).map((obs) => {
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
															Selected
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
							</Surface>
						</div>

						{/* Right Column: Spatial Map + Proximity Notice + Metadata Grid */}
						<div className="public-detail-column public-detail-column--secondary stack-md">
							{/* Spatial Context Card */}
							<Surface as="section" className="public-detail-card-section">
								<div className="public-detail-card-section__header">
									<h2>Location Context</h2>
									<p className="caption-text">
										Privacy-consented citizen location coordinate pin
									</p>
								</div>

								<div className="compact-map-wrapper">
									<StaticReceiptMap location={report.publicLocation} />
								</div>

								<div
									className={`detail-outbreak-alert detail-outbreak-alert--${hotspotContext.state}`}
								>
									<div className="detail-outbreak-alert__badge">
										{hotspotContext.badge}
									</div>
								</div>
							</Surface>

							{/* Metadata details grid */}
							<Surface as="section" className="public-detail-card-section">
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
							</Surface>
						</div>
					</div>
				</div>
			) : null}
			</div>
		</div>
	);
}
