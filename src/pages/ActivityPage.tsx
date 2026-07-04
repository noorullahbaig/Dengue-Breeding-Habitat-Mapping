import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
	Clock3,
	LogIn,
	Search,
	Trash2,
	ChevronRight,
	Plus,
	ClipboardList,
} from "lucide-react";
import { useAuth } from "@/app/useAuth";
import { useServices } from "@/app/useServices";
import { StatusBadge } from "@/features/shared/StatusBadge";
import { formatTimestamp } from "@/lib/formatters";
import type { ReportStatus } from "@/types/report";
import "@/styles/activity.css";

interface ActivityItem {
	reference: string;
	report: ReportStatus | null;
}

export function ActivityPage() {
	const location = useLocation();
	const { isAuthenticated, isAuthLoading, sessionMode, trackedReferences, untrackReport } = useAuth();
	const { reportsService } = useServices();
	const [items, setItems] = useState<ActivityItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState("");
	const [mounted, setMounted] = useState(false);
	const feedback = (location.state as { feedback?: string } | null)?.feedback;

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		let isMounted = true;

		async function loadActivity() {
			if (!isAuthenticated) {
				setItems([]);
				return;
			}

				setIsLoading(true);
				setLoadError("");

			try {
				// Fetch user's reports from backend API
				const userReports = await reportsService.getMyReports();
				
				if (isMounted) {
					setItems(
						userReports.map((report) => ({
							reference: report.reference,
							report,
						})),
					);
				}
			} catch (err) {
				console.error("Failed to load user reports from API:", err);
				
				// Fallback to localStorage-tracked reports if API fails
					if (isMounted && sessionMode === "local" && trackedReferences.length > 0) {
					console.log("Falling back to localStorage-tracked reports");
					const reports = await Promise.all(
						trackedReferences.map(async (reference) => ({
							reference,
							report: await reportsService.getReportStatus(reference),
						})),
					);
					setItems(reports);
					} else {
						setItems([]);
						if (isMounted) {
							setLoadError("Your reports could not be loaded. Please try again.");
						}
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		void loadActivity();

		return () => {
			isMounted = false;
		};
		}, [isAuthenticated, sessionMode, trackedReferences, reportsService]);

	return (
		<div
			className={`activity-page ${mounted ? "activity-page--mounted" : ""}`}
		>
			{/* Decorative background */}
			<div className="activity-bg" aria-hidden="true">
				<div className="activity-bg__orb activity-bg__orb--1" />
				<div className="activity-bg__orb activity-bg__orb--2" />
				<div className="activity-bg__orb activity-bg__orb--3" />
				<div className="activity-bg__grid" />
			</div>

			<div className="activity-scroll">

					{isAuthLoading ? (
						<main className="activity-card">
							<div className="activity-loading" role="status">
								<div className="activity-loading__spinner" aria-hidden="true" />
								<span>Restoring your account…</span>
							</div>
						</main>
					) : !isAuthenticated ? (
					/* ── GATE: NOT SIGNED IN ── */
					<main className="activity-card">
						{/* Top centred content */}
						<div className="activity-gate-body">
							<div className="activity-gate-icon">
								<div className="activity-gate-icon__wrap">
									<Clock3 size={26} />
								</div>
							</div>

							<h1 className="activity-gate-title">Your Report Activity</h1>
							<p className="activity-gate-sub">
								Sign in to see status updates on every report you've
								submitted — your private feed, all in one place.
							</p>
						</div>

						{/* Buttons pinned at card bottom */}
						<div className="activity-gate-actions">
							<Link
								to="/profile?redirect=%2Factivity"
								className="activity-primary-btn"
							>
								<LogIn size={18} />
								Sign In to View Activity
							</Link>
							<Link to="/status" className="activity-ghost-btn">
								<Search size={16} />
								Track by Reference Code
							</Link>
							<p className="activity-gate-note">
								Reporting is always open to everyone — no account needed.
							</p>
						</div>
					</main>
				) : (
					/* ── SIGNED IN ── */
					<main className="activity-card">
						{/* Top strip */}
						<div className="activity-topstrip">
							<div>
								<p className="activity-topstrip__label">Resident activity</p>
								<h1 className="activity-topstrip__title">Your Reports</h1>
							</div>
						</div>

						{/* Feedback banner */}
							{feedback && (
								<div className="activity-feedback" role="status">
									{feedback}
								</div>
							)}
							{loadError && (
								<div className="activity-feedback" role="alert">
									{loadError}
								</div>
							)}

						{isLoading ? (
							/* Loading */
							<div className="activity-loading">
								<div className="activity-loading__spinner" aria-hidden="true" />
								<span>Loading your reports…</span>
							</div>
						) : items.length === 0 ? (
							/* Empty */
							<>
								<div className="activity-empty-icon">
									<div className="activity-empty-icon__wrap">
										<ClipboardList size={26} />
									</div>
								</div>
								<p className="activity-empty-title">No reports saved yet</p>
								<p className="activity-empty-sub">
									Submit a report then tap "Save to my activity" from the
									confirmation screen.
								</p>
							</>
						) : (
							/* Report list — inner scroll, card doesn't scroll */
							<ul className="activity-inner-list">
								{items.map(({ reference, report }) => (
									<li
										key={reference}
										className={`activity-item${!report ? " activity-item--missing" : ""}`}
									>
										<div className="activity-item__row">
											<div>
												<p className="activity-item__ref-label">Reference</p>
												<p className="activity-item__ref">{reference}</p>
											</div>
											{report ? (
												<StatusBadge status={report.status} />
											) : (
												<span
													style={{
														fontSize: "0.75rem",
														color: "var(--color-ink-soft)",
														fontFamily: "var(--font-label)",
													}}
												>
													Unavailable
												</span>
											)}
										</div>

										{report && (
											<div className="activity-item__meta">
												<span>{report.neighborhood}</span>
												<span className="activity-item__meta-dot" />
												<span>{formatTimestamp(report.createdAt)}</span>
											</div>
										)}

										{!report && (
											<p className="activity-item__missing-note">
												This reference could not be loaded from the current
												report store.
											</p>
										)}

										<div className="activity-item__actions">
											<Link
												to={`/status?ref=${reference}`}
												className="activity-item__view-btn"
											>
												View Status
												<ChevronRight size={14} />
											</Link>
												{sessionMode === "local" && <button
												type="button"
												className="activity-item__remove-btn"
												onClick={() => untrackReport(reference)}
												aria-label={`Remove ${reference}`}
											>
												<Trash2 size={14} />
												</button>}
										</div>
									</li>
								))}
							</ul>
						)}

						{/* Bottom actions — always visible */}
						<div className="activity-bottom-actions">
							<Link to="/report" className="activity-primary-btn">
								<Plus size={18} />
								{items.length > 0 ? "Start Another Report" : "Start a Report"}
							</Link>
							{items.length === 0 && (
								<Link to="/status" className="activity-ghost-btn">
									<Search size={16} />
									Track by Reference Code
								</Link>
							)}
						</div>
					</main>
				)}
			</div>
		</div>
	);
}
