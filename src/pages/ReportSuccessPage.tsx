import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Check, Copy } from "lucide-react";
import { useAuth } from "@/app/useAuth";
import { useReportDraft } from "@/app/useReportDraft";
import { useServices } from "@/app/useServices";
import { Notice, ButtonLink, LoadingState, Surface } from "@/components/ui";
import { API_BASE_URL } from "@/config";
import { formatTimestamp } from "@/lib/formatters";
import reportSubmittedIllustration from "@/assets/report/report-submitted.png";
import { PredictionEvidencePanel } from "@/pages/components/PredictionEvidencePanel";
import type { ReportStatus } from "@/types/report";

function SuccessHero() {
	return (
		<div className="success-hero">
			<div className="success-hero__illustration">
				<div className="success-hero__portrait">
					<img src={reportSubmittedIllustration} alt="" aria-hidden="true" />
				</div>
			</div>
			<h1 className="success-hero__title">Report submitted</h1>
			<p className="success-hero__subtitle">
				Thank you for helping map breeding habitats in our community.
			</p>
		</div>
	);
}

interface TrackingBlockProps {
	copied: boolean;
	onCopy: () => Promise<void>;
	reference: string;
}

function TrackingBlock({ copied, onCopy, reference }: TrackingBlockProps) {
	return (
		<div className="report-success-page__tracking-block">
			<p className="caption-text tracking-id-label">Your anonymous Tracking ID</p>
			<button
				type="button"
				className={`reference-copy-pill ${copied ? "reference-copy-pill--copied" : ""}`}
				onClick={() => void onCopy()}
				aria-label="Copy tracking ID to clipboard"
			>
				<span className="reference-copy-pill__meta">
					{copied ? <Check size={16} /> : <Copy size={14} />}
					<span className="reference-copy-pill__status">
						{copied ? "Copied!" : "Tap to copy"}
					</span>
				</span>
				<span className="reference-copy-pill__code">{reference}</span>
			</button>
		</div>
	);
}

interface ReceiptActionsProps {
	reference: string;
}

function ReceiptActions({ reference }: ReceiptActionsProps) {
	return (
		<div className="report-success-page__actions">
			<ButtonLink
				to={`/status?ref=${reference}`}
				size="large"
				fullWidth
				className="report-success-page__action-link"
			>
				Track report status
			</ButtonLink>
			<ButtonLink
				to="/report"
				variant="secondary"
				size="large"
				fullWidth
				className="report-success-page__action-link"
			>
				Report another habitat
			</ButtonLink>
			<ButtonLink
				to="/"
				variant="ghost"
				size="large"
				fullWidth
				className="report-success-page__action-link report-success-page__action-link--quiet"
			>
				Return home
			</ButtonLink>
		</div>
	);
}

interface AccountPanelProps {
	isAuthenticated: boolean;
	reference: string;
	sessionMode: string;
}

function AccountPanel({
	isAuthenticated,
	reference,
	sessionMode,
}: AccountPanelProps) {
	if (isAuthenticated) {
		return (
			<Surface className="report-success-account-panel report-success-account-panel--saved">
				<div className="report-success-account-panel__content">
					<div className="report-attach-panel__success-header">
						<div className="report-attach-panel__success-icon">
							<Check size={20} strokeWidth={3} />
						</div>
						<div>
							<h2 className="report-attach-panel__success-title">
								Report saved to your account
							</h2>
							<p className="caption-text report-attach-panel__success-desc">
								This submission has been automatically linked to your activity history.
							</p>
						</div>
					</div>
					<div className="report-attach-panel__success-actions">
						<ButtonLink to="/activity" variant="ghost" size="small">
							View activity
						</ButtonLink>
					</div>
				</div>
			</Surface>
		);
	}

	return (
		<Surface className="report-success-account-panel">
			<div className="report-success-account-panel__content">
				<div className="report-attach-panel__copy">
					<span className="detail-grid__label">Optional account save</span>
					<h2>Want to save this report to an account?</h2>
					<p>
						Sign in to keep this report in your activity history. You can still
						track this report anytime with the Tracking ID above, no account needed.
					</p>
				</div>

				<Notice tone="info" className="auth-inline-note">
					{sessionMode === "cognito"
						? "Saved activity follows your account across devices."
						: "Saved activity stays on this device."}
				</Notice>

				<div className="report-attach-panel__actions">
					<ButtonLink
						to={`/profile?attachRef=${encodeURIComponent(reference)}&redirect=%2Factivity`}
						variant="secondary"
						fullWidth
					>
						Sign in to save it
					</ButtonLink>
				</div>
			</div>
		</Surface>
	);
}

export function ReportSuccessPage() {
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

	const reference = searchParams.get("ref") ?? lastSubmittedReference;
	const alreadySaved = reference ? trackedReferences.includes(reference) : false;

	useEffect(() => {
		if (isAuthenticated && reference && !alreadySaved && !savedToActivity) {
			trackReport(reference);
			setSavedToActivity(true);
		}
	}, [alreadySaved, isAuthenticated, reference, savedToActivity, trackReport]);

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

	return (
		<div className="page-layout report-success-page">
			{isLoading ? (
				<LoadingState label="Loading your submission receipt..." />
			) : report ? (
				<div className="report-success-page__content">
					<SuccessHero />

					<Surface className="report-success-receipt">
						<div className="report-success-receipt__section report-success-receipt__section--evidence">
							<PredictionEvidencePanel
								prediction={report.prediction}
								title="Submission evidence"
								imageUrl={`${API_BASE_URL}/public/reports/${report.reference}/image`}
								imageAlt="Your submitted photo evidence"
								compact
							/>
						</div>
						<div className="report-success-receipt__section">
							<TrackingBlock
								copied={copied}
								onCopy={handleCopyToClipboard}
								reference={report.reference}
							/>
						</div>
						<div className="report-success-receipt__section">
							<div className="minimal-success-grid">
								<div className="minimal-success-grid__item">
									<span className="detail-grid__label">Reported at</span>
									<strong>{formatTimestamp(report.createdAt)}</strong>
								</div>
								<div className="minimal-success-grid__item">
									<span className="detail-grid__label">Neighborhood</span>
									<strong>{report.neighborhood}</strong>
								</div>
							</div>
						</div>
						{report.stackedOnReference ? (
							<div className="report-success-receipt__section">
								<Notice tone="success" className="report-success-page__stack-note">
									<p className="caption-text report-success-page__stack-copy">
										Linked as stacked photo evidence on parent report:{" "}
										<strong>{report.stackedOnReference}</strong>
									</p>
								</Notice>
							</div>
						) : null}
					</Surface>

					<ReceiptActions reference={report.reference} />
					{reference ? (
						<AccountPanel
							isAuthenticated={isAuthenticated}
							reference={reference}
							sessionMode={sessionMode}
						/>
					) : null}
				</div>
			) : reference ? (
				<div className="report-success-page__content">
					<SuccessHero />

					<Surface className="report-success-receipt report-success-receipt--fallback">
						<div className="report-success-receipt__section">
							<Notice
								tone="warning"
								className="report-success-page__warning"
								icon={<AlertCircle size={18} className="report-success-page__warning-icon" />}
							>
								<p className="report-success-page__warning-copy">
									Your report was submitted. Receipt details are still loading, so
									keep the Tracking ID below.
								</p>
							</Notice>
						</div>
						<div className="report-success-receipt__section">
							<TrackingBlock
								copied={copied}
								onCopy={handleCopyToClipboard}
								reference={reference}
							/>
						</div>
					</Surface>

					<ReceiptActions reference={reference} />
					<AccountPanel
						isAuthenticated={isAuthenticated}
						reference={reference}
						sessionMode={sessionMode}
					/>
				</div>
			) : (
				<div className="empty-state stack-md report-success-page__empty">
					<p>
						No report reference was loaded. Start a new report or track a report
						manually.
					</p>
					<div className="page-header__actions report-success-page__actions">
						<ButtonLink to="/report" className="report-success-page__action-link">
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
