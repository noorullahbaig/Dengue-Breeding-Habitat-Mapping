import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, AlertCircle } from "lucide-react";
import { useAuth } from "@/app/useAuth";
import { useReportDraft } from "@/app/useReportDraft";
import { useServices } from "@/app/useServices";
import { PredictionEvidencePanelV2 } from "@/pages/ux-v2/components/PredictionEvidencePanelV2";
import { formatTimestamp } from "@/lib/formatters";
import type { ReportStatus } from "@/types/report";
import { Notice, Surface, Button, ButtonLink, LoadingState } from "@/components/ui";

export function ReportSuccessPageV2() {
	const { reportsService } = useServices();
	const { lastSubmittedReference, resetDraft } = useReportDraft();
	const { isAuthenticated, sessionMode, trackReport, trackedReferences } =
		useAuth();
	const [searchParams] = useSearchParams();
	const [report, setReport] = useState<ReportStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const hasResetDraft = useRef(false);
	const [copied, setCopied] = useState(false);
	const [savedToActivity, setSavedToActivity] = useState(false);
	const [isDismissed, setIsDismissed] = useState(false);

	const reference = searchParams.get("ref") ?? lastSubmittedReference;

	const alreadySaved = reference
		? trackedReferences.includes(reference)
		: false;

	useEffect(() => {
		if (isAuthenticated && reference && !alreadySaved && !savedToActivity) {
			trackReport(reference);
			setSavedToActivity(true);
		}
	}, [isAuthenticated, reference, alreadySaved, savedToActivity, trackReport]);

	useEffect(() => {
		if (!hasResetDraft.current) {
			resetDraft();
			hasResetDraft.current = true;
		}
	}, [resetDraft]);

	useEffect(() => {
		let isMounted = true;

		async function loadStatus() {
			if (!reference) {
				setIsLoading(false);
				return;
			}

			try {
				const nextReport = await reportsService.getReportStatus(reference);
				if (isMounted) {
					setReport(nextReport);
				}
			} catch (err) {
				console.error("Failed to load success report status:", err);
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		void loadStatus();

		return () => {
			isMounted = false;
		};
	}, [reference, reportsService]);

	async function handleCopyToClipboard() {
		if (!reference) return;
		try {
			await navigator.clipboard.writeText(reference);
			setCopied(true);
			setTimeout(() => setCopied(false), 2500);
		} catch (err) {
			console.error("Failed to copy code:", err);
		}
	}



	function renderAttachPanel(currentReference: string) {
		if (isDismissed) {
			return null;
		}

		if (isAuthenticated) {
			return (
				<Surface className="report-attach-panel report-attach-panel--success">
					<div className="stack-md">
						<div className="report-attach-panel__success-header">
							<div className="report-attach-panel__success-icon">
								<Check size={20} strokeWidth={3} />
							</div>
							<div>
								<h3 className="report-attach-panel__success-title">Report saved to your account</h3>
								<p className="caption-text report-attach-panel__success-desc">
									This submission has been automatically linked to your activity history.
								</p>
							</div>
						</div>
						<div className="report-attach-panel__success-actions">
							<ButtonLink to="/activity" variant="ghost" size="small">
								View Saved Activity
							</ButtonLink>
						</div>
					</div>
				</Surface>
			);
		}

		return (
			<Surface className="report-attach-panel">
				<div className="report-attach-panel__copy">
					<span className="detail-grid__label">Track your report</span>
					<h2>Want to follow up on this report?</h2>
					<p>
						Your report is submitted. Sign in to save it to your account, or use
						the Tracking ID above to check status anytime — no account needed.
					</p>
				</div>

				<Notice tone="info" className="auth-inline-note">
					{sessionMode === "cognito"
						? "Saved activity follows your account across devices."
						: "Saved activity stays on this device."}
				</Notice>

				<div className="report-attach-panel__actions">
					<ButtonLink
						to={`/profile?mode=signin&attachRef=${encodeURIComponent(currentReference)}&redirect=%2Factivity`}
					>
						Sign In & Save to Account
					</ButtonLink>
					<Button
						variant="ghost"
						className="report-attach-panel__dismiss"
						onClick={() => setIsDismissed(true)}
					>
						I'll use the Tracking ID
					</Button>
				</div>
			</Surface>
		);
	}

	return (
		<div className="page-layout report-success-page">
			{isLoading ? (
				<LoadingState label="Loading your submission receipt..." />
			) : report ? (
				<div className="stack-md">
					{/* 1. Hero Success Animation */}
					<div className="success-hero">
						<div className="success-hero__checkmark-wrapper">
							<svg aria-hidden="true" className="success-hero__checkmark-svg" viewBox="0 0 52 52">
								<circle
									className="success-hero__checkmark-fill-circle"
									cx="26"
									cy="26"
									r="25"
								/>
								<circle
									className="success-hero__checkmark-circle"
									cx="26"
									cy="26"
									r="25"
									fill="none"
								/>
								<path
									className="success-hero__checkmark-check"
									fill="none"
									d="M14.1 27.2l7.1 7.2 16.7-16.8"
								/>
							</svg>
						</div>
						<h1 className="success-hero__title">Report submitted</h1>
						<p className="success-hero__subtitle">
							Thank you for helping map breeding habitats in our community.
						</p>
					</div>

					{/* 2. Visual Evidence Panel */}
					<div className="slide-up-content delay-1">
						<PredictionEvidencePanelV2
							prediction={report.prediction}
							title="Submission evidence"
							imageUrl={`http://localhost:8000/api/public/reports/${report.reference}/image`}
							imageAlt="Your submitted photo evidence"
							compact
							showDetections
						/>
					</div>

					{/* 3. Sleek Reference Code Copy Pill */}
					<div className="slide-up-content delay-2 report-success-page__centered">
						<p className="caption-text tracking-id-label">
							Your anonymous Tracking ID — tap to copy
						</p>
						<button
							type="button"
							className={`reference-copy-pill ${copied ? "reference-copy-pill--copied" : ""}`}
							onClick={handleCopyToClipboard}
							aria-label="Copy reference code to clipboard"
						>
							{copied ? (
								<>
									<Check size={16} />
									<span>Copied!</span>
								</>
							) : (
								<>
									<Copy size={14} />
									<span className="reference-copy-pill__code">
										{report.reference}
									</span>
								</>
							)}
						</button>
					</div>

					{/* 4. Minimal Detail Grid */}
					<div className="slide-up-content delay-2">
						<div className="minimal-success-grid">
							<div className="minimal-success-grid__item">
								<span className="detail-grid__label">Reported At</span>
								<strong>{formatTimestamp(report.createdAt)}</strong>
							</div>
							<div className="minimal-success-grid__item">
								<span className="detail-grid__label">Neighborhood</span>
								<strong>{report.neighborhood}</strong>
							</div>
						</div>

						{report.stackedOnReference && (
							<Notice
								tone="success"
								className="report-success-page__stack-note"
							>
								<p className="caption-text report-success-page__stack-copy">
									Linked as stacked photo evidence on parent report:{" "}
									<strong>{report.stackedOnReference}</strong>
								</p>
							</Notice>
						)}
					</div>

					{reference ? (
						<div className="slide-up-content delay-3">
							{renderAttachPanel(reference)}
						</div>
					) : null}

					{/* 5. Primary Actions */}
					<div className="page-header__actions slide-up-content delay-3 report-success-page__actions">
						<ButtonLink
							to={`/status?ref=${report.reference}`}
							className="report-success-page__action-link"
						>
							Track Live Status
						</ButtonLink>
						<ButtonLink
							to="/report"
							variant="secondary"
							className="report-success-page__action-link"
						>
							Report Another Habitat
						</ButtonLink>
						<ButtonLink
							to="/"
							variant="ghost"
							className="report-success-page__action-link"
						>
							Return to Home
						</ButtonLink>
					</div>
				</div>
			) : reference ? (
				<div className="stack-md">
					{/* Hero Success Animation (Still shown even if receipt loading failed) */}
					<div className="success-hero">
						<div className="success-hero__checkmark-wrapper">
							<svg aria-hidden="true" className="success-hero__checkmark-svg" viewBox="0 0 52 52">
								<circle
									className="success-hero__checkmark-fill-circle"
									cx="26"
									cy="26"
									r="25"
								/>
								<circle
									className="success-hero__checkmark-circle"
									cx="26"
									cy="26"
									r="25"
									fill="none"
								/>
								<path
									className="success-hero__checkmark-check"
									fill="none"
									d="M14.1 27.2l7.1 7.2 16.7-16.8"
								/>
							</svg>
						</div>
						<h1 className="success-hero__title">Report submitted</h1>
						<p className="success-hero__subtitle">
							Thank you for helping map breeding habitats in our community.
						</p>
					</div>

					{/* Fallback Warning Strip */}
					<Notice
						tone="warning"
						className="slide-up-content delay-1 report-success-page__warning"
					>
						<AlertCircle
							size={18}
							className="report-success-page__warning-icon"
						/>
						<p className="report-success-page__warning-copy">
							Your report was submitted. Receipt details are still loading, so
							keep the reference code below.
						</p>
					</Notice>

					{/* Reference copy pill */}
					<div className="slide-up-content delay-2 report-success-page__centered">
						<p className="caption-text tracking-id-label">
							Your anonymous Tracking ID — tap to copy
						</p>
						<button
							type="button"
							className={`reference-copy-pill ${copied ? "reference-copy-pill--copied" : ""}`}
							onClick={handleCopyToClipboard}
							aria-label="Copy reference code to clipboard"
						>
							{copied ? (
								<>
									<Check size={16} />
									<span>Copied!</span>
								</>
							) : (
								<>
									<Copy size={14} />
									<span className="reference-copy-pill__code">{reference}</span>
								</>
							)}
						</button>
					</div>

					<div className="slide-up-content delay-2">
						{renderAttachPanel(reference)}
					</div>

					{/* Action buttons */}
					<div className="page-header__actions slide-up-content delay-3 report-success-page__actions">
						<ButtonLink
							to={`/status?ref=${reference}`}
							className="report-success-page__action-link"
						>
							Track Live Status
						</ButtonLink>
						<ButtonLink
							to="/report"
							variant="secondary"
							className="report-success-page__action-link"
						>
							Report Another Habitat
						</ButtonLink>
						<ButtonLink
							to="/"
							variant="ghost"
							className="report-success-page__action-link"
						>
							Return to Home
						</ButtonLink>
					</div>
				</div>
			) : (
				<div className="empty-state stack-md report-success-page__empty">
					<p>
						No report reference was loaded. Start a new report or track a report
						manually.
					</p>
					<div className="page-header__actions report-success-page__actions">
						<ButtonLink
							to="/report"
							className="report-success-page__action-link"
						>
							Report a site
						</ButtonLink>
						<ButtonLink
							to="/status"
							variant="secondary"
							className="report-success-page__action-link"
						>
							Track status manually
						</ButtonLink>
					</div>
				</div>
			)}
		</div>
	);
}
