import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
	ArrowLeft,
	CheckCircle2,
	Clock,
	Info,
	Link2,
	Map as MapIcon,
	Search,
	ShieldAlert,
} from "lucide-react";
import { useServices } from "@/app/useServices";
import { Button, EmptyState, LoadingState, Surface } from "@/components/ui";
import { API_BASE_URL } from "@/config";
import { StatusBadge } from "@/features/shared/StatusBadge";
import {
	formatConfidenceScore,
	formatHabitatLabel,
	formatTimestamp,
} from "@/lib/formatters";
import { PredictionEvidencePanel } from "@/pages/components/PredictionEvidencePanel";
import type { ReportStatus } from "@/types/report";

const statusSequence = [
	"submitted",
	"under_review",
	"prioritized",
	"action_recorded",
	"closed",
];

const statusLabels: Record<string, string> = {
	submitted: "Submitted",
	under_review: "Under Review",
	prioritized: "Prioritized",
	action_recorded: "Action Logged",
	closed: "Closed",
};

const statusDescriptions: Record<string, string> = {
	submitted: "Received by the system.",
	under_review: "A legacy review status is recorded.",
	prioritized: "A legacy priority status is recorded.",
	action_recorded: "A legacy follow-up status is recorded.",
	closed: "This report is recorded as closed.",
};

interface ReportStatusLookupProps {
	reference: string;
	onSearch: (reference: string) => void;
	onBack: () => void;
	variant: "standalone" | "activity";
}

export function ReportStatusLookup({
	reference,
	onSearch,
	onBack,
	variant,
}: ReportStatusLookupProps) {
	const { reportsService } = useServices();
	const [report, setReport] = useState<ReportStatus | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [copyFeedback, setCopyFeedback] = useState("");
	const [searchInput, setSearchInput] = useState(reference);

	useEffect(() => {
		setSearchInput(reference);
		let isMounted = true;

		async function loadStatus() {
			if (!reference) {
				setReport(null);
				return;
			}

			setIsLoading(true);
			try {
				const nextReport = await reportsService.getReportStatus(reference);
				if (isMounted) setReport(nextReport);
			} catch (error) {
				console.error("Failed to load report status in lookup:", error);
				if (isMounted) setReport(null);
			} finally {
				if (isMounted) setIsLoading(false);
			}
		}

		void loadStatus();
		return () => {
			isMounted = false;
		};
	}, [reference, reportsService]);

	async function handleCopyLink() {
		if (!reference) return;
		const url = new URL("/status", window.location.origin);
		url.searchParams.set("ref", reference);
		try {
			await navigator.clipboard.writeText(url.toString());
			setCopyFeedback("Link copied!");
			window.setTimeout(() => setCopyFeedback(""), 3000);
		} catch {
			setCopyFeedback("Failed to copy link.");
		}
	}

	function handleSearchSubmit(event: FormEvent) {
		event.preventDefault();
		const normalizedReference = searchInput.trim().toUpperCase();
		if (normalizedReference) {
			onSearch(normalizedReference);
		} else {
			onBack();
		}
	}

	const activeStatusIndex = report ? statusSequence.indexOf(report.status) : -1;
	const rootClassName = `report-status-lookup report-status-lookup--${variant} page-layout page--status`;

	if (!reference && !isLoading) {
		return (
			<div className={rootClassName}>
				<Surface className="status-hero-container">
					<EmptyState
						title="Track Your Report"
						icon={<ShieldAlert size={48} strokeWidth={1.5} />}
					>
						<p className="status-hero-subtitle">
							Enter your secure reference code to check triage updates and
							status information by reference code.
						</p>

						<form className="status-hero-form" onSubmit={handleSearchSubmit}>
							<div className="status-hero-input-wrap">
								<Search size={20} className="status-hero-search-icon" />
								<input
									type="text"
									placeholder="e.g. KL-ABCD-1234"
									value={searchInput}
									onChange={(event) => setSearchInput(event.target.value)}
									className="status-hero-input"
								/>
							</div>
							<Button type="submit" variant="primary">
								Track Status
							</Button>
						</form>
					</EmptyState>
				</Surface>
			</div>
		);
	}

	return (
		<div className={rootClassName}>
			<div className="page-body">
				<header className="status-dashboard-header">
					<Button
						variant="ghost"
						onClick={onBack}
						className="status-dashboard-back"
						title="Back to Search"
						aria-label="Back to search"
					>
						<ArrowLeft size={20} />
					</Button>
					<form
						className="status-dashboard-search"
						onSubmit={handleSearchSubmit}
					>
						<input
							type="text"
							value={searchInput}
							onChange={(event) => setSearchInput(event.target.value)}
							placeholder="Search another reference..."
							className="status-dashboard-input"
						/>
						<button
							type="submit"
							className="status-dashboard-search-btn"
							aria-label="Search reference"
						>
							<Search size={16} />
						</button>
					</form>
				</header>

				<main className="status-dashboard-main">
					{isLoading ? (
						<LoadingState label="Locating report securely..." />
					) : !report ? (
						<EmptyState
							title="Report Not Found"
							icon={
								<Search
									size={48}
									className="status-not-found-icon"
									strokeWidth={1.5}
								/>
							}
							actions={
								<Button variant="secondary" onClick={onBack}>
									Search Again
								</Button>
							}
						>
							<p>
								We couldn't find a report matching "<strong>{reference}</strong>
								".
							</p>
							<p className="caption-text">
								Check the reference code and try again.
							</p>
						</EmptyState>
					) : (
						<Surface className="status-report-card">
							<div className="status-report-header">
								<div className="status-report-title-group">
									<span className="status-report-label">Reference Code</span>
									<div className="status-report-title-row">
										<h1 className="status-report-id">{report.reference}</h1>
										<button
											type="button"
											className="status-copy-btn"
											onClick={handleCopyLink}
											title="Copy Tracking Link"
											aria-label="Copy tracking link"
										>
											<Link2 size={16} />
										</button>
										{copyFeedback && (
											<span className="status-copy-feedback">
												{copyFeedback}
											</span>
										)}
									</div>
								</div>
								<div className="status-report-badge-wrap">
									<StatusBadge status={report.status} />
								</div>
							</div>

							<div className="status-stepper-premium">
								{statusSequence.map((step, index) => {
									const isActive = report.status === step;
									const isCompleted = index < activeStatusIndex;

									return (
										<div
											key={step}
											className={`status-stepper-item ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
										>
											<div className="status-stepper-icon">
												{isCompleted ? (
													<CheckCircle2 size={18} />
												) : isActive ? (
													<Clock size={18} />
												) : (
													<span>{index + 1}</span>
												)}
											</div>
											<div className="status-stepper-text">
												<span className="status-stepper-title">
													{statusLabels[step]}
												</span>
												{isActive && (
													<span className="status-stepper-desc">
														{statusDescriptions[step]}
													</span>
												)}
											</div>
											{index < statusSequence.length - 1 && (
												<div className="status-stepper-connector" />
											)}
										</div>
									);
								})}
							</div>

							<div className="status-report-body">
								<div className="status-report-info">
									{report.statusMessage && (
										<div className="status-message-box">
											<Info size={18} className="status-message-icon" />
											<div>
												<strong>Latest Update</strong>
												<p>{report.statusMessage}</p>
											</div>
										</div>
									)}

									<div className="status-detail-grid">
										<div className="status-detail-item">
											<span className="status-detail-label">
												Date Submitted
											</span>
											<span className="status-detail-val">
												{formatTimestamp(report.createdAt)}
											</span>
										</div>
										<div className="status-detail-item">
											<span className="status-detail-label">Location Area</span>
											<span className="status-detail-val">
												{report.neighborhood}
											</span>
										</div>
										<div className="status-detail-item">
											<span className="status-detail-label">
												AI Habitat Advisory
											</span>
											<span className="status-detail-val">
												{formatHabitatLabel(report.prediction.label)}
											</span>
										</div>
										<div className="status-detail-item">
											<span className="status-detail-label">
												Confidence Score
											</span>
											<span className="status-detail-val">
												{formatConfidenceScore(report.prediction.confidence)}
											</span>
										</div>
									</div>

									<div className="status-report-actions">
										<Link
											to={`/map/reports/${report.stackedOnReference ?? report.reference}`}
											className="status-action-link"
										>
											<MapIcon size={18} />
											View on Public Map
										</Link>
									</div>
								</div>

								<div className="status-report-evidence">
									<PredictionEvidencePanel
										prediction={report.prediction}
										title="Evidence Analyzed"
										imageUrl={`${API_BASE_URL}/public/reports/${report.reference}/image`}
										imageAlt="Citizen evidence thumbnail"
										compact
									/>
								</div>
							</div>
						</Surface>
					)}
				</main>
			</div>
		</div>
	);
}
