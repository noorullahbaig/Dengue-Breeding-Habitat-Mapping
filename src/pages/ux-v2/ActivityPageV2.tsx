import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Clock3, LogIn, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/app/useAuth";
import { useServices } from "@/app/useServices";
import { StatusBadge } from "@/features/shared/StatusBadge";
import { formatTimestamp } from "@/lib/formatters";
import type { ReportStatus } from "@/types/report";
import {
	Button,
	ButtonLink,
	DefinitionGrid,
	DefinitionItem,
	EmptyState,
	LoadingState,
	MetaLabel,
	Notice,
	Surface,
} from "@/components/ui";

interface ActivityItem {
	reference: string;
	report: ReportStatus | null;
}

export function ActivityPageV2() {
	const location = useLocation();
	const { isAuthenticated, trackedReferences, untrackReport } = useAuth();
	const { reportsService } = useServices();
	const [items, setItems] = useState<ActivityItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const feedback = (location.state as { feedback?: string } | null)?.feedback;

	useEffect(() => {
		let isMounted = true;

		async function loadActivity() {
			if (!isAuthenticated || trackedReferences.length === 0) {
				setItems([]);
				return;
			}

			setIsLoading(true);

			try {
				const reports = await Promise.all(
					trackedReferences.map(async (reference) => ({
						reference,
						report: await reportsService.getReportStatus(reference),
					})),
				);

				if (isMounted) {
					setItems(reports);
				}
			} catch (err) {
				console.error("Failed to load resident activity:", err);
				if (isMounted) {
					setItems(
						trackedReferences.map((reference) => ({ reference, report: null })),
					);
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
	}, [isAuthenticated, trackedReferences, reportsService]);

	if (!isAuthenticated) {
		return (
			<div className="page-layout page--activity">
				<Surface as="section" className="activity-gate">
					<EmptyState
						title="Sign in to view your saved reports."
						icon={<Clock3 size={28} />}
						actions={
							<div className="activity-gate__actions">
								<ButtonLink to="/profile?mode=signin&redirect=%2Factivity" fullWidth>
									<LogIn size={18} />
									Sign In to View Activity
								</ButtonLink>
								<ButtonLink to="/status" variant="ghost" fullWidth>
									<Search size={18} />
									Track by Reference Code
								</ButtonLink>
							</div>
						}
					>
						<p>
							Reporting stays open to everyone. Sign in only if you want a
							private list of the reports you choose to attach after
							submission.
						</p>
						<p className="activity-gate__hint">
							Only reports you attach after submission appear here.
						</p>
					</EmptyState>
				</Surface>
			</div>
		);
	}

	return (
		<div className="page-layout page--activity">
			<div className="page-body">
				<Surface as="section" className="activity-summary">
					<div>
						<MetaLabel>Resident activity</MetaLabel>
						<h1 className="activity-summary__title">
							Your saved report activity
						</h1>
						<p className="activity-summary__body">
							This list shows only the reports you explicitly attached to your
							profile after submission.
						</p>
					</div>
					<div className="activity-summary__meta">
						<strong>{trackedReferences.length}</strong>
						<span>saved reports</span>
					</div>
				</Surface>

				<div className="activity-toolbar">
					<ButtonLink to="/report" variant="secondary">
						Start another report
					</ButtonLink>
					<ButtonLink to="/status" variant="ghost">
						Track by code
					</ButtonLink>
				</div>

			{feedback ? (
				<Notice tone="success" className="auth-inline-note">
					{feedback}
				</Notice>
			) : null}

			{isLoading ? (
				<Surface>
					<LoadingState label="Loading your saved reports…" />
				</Surface>
			) : items.length === 0 ? (
				<Surface className="activity-empty">
					<EmptyState
						title="No saved reports yet"
						icon={<Clock3 size={28} />}
						actions={
							<>
								<ButtonLink to="/report">Start Report</ButtonLink>
								<ButtonLink to="/status" variant="ghost">
									<Search size={18} />
									Track by Code Instead
								</ButtonLink>
							</>
						}
					>
						<p>
							Submit a report first, then attach it to your profile from the
							receipt screen.
						</p>
					</EmptyState>
				</Surface>
			) : (
				<div className="activity-list">
					{items.map(({ reference, report }) => (
						<Surface as="article" key={reference} className="activity-item">
							<div className="activity-item__header">
								<div>
									<MetaLabel>Reference</MetaLabel>
									<h2 className="activity-item__title">{reference}</h2>
								</div>
								{report ? (
									<StatusBadge status={report.status} />
								) : (
									<span className="status-badge">Unavailable</span>
								)}
							</div>

							{report ? (
								<DefinitionGrid className="activity-item__grid">
									<DefinitionItem label="Neighborhood">
										{report.neighborhood}
									</DefinitionItem>
									<DefinitionItem label="Submitted">
										{formatTimestamp(report.createdAt)}
									</DefinitionItem>
								</DefinitionGrid>
							) : (
								<p className="activity-item__missing">
									This saved reference could not be loaded from the current
									report store.
								</p>
							)}

							<div className="activity-item__actions">
								<ButtonLink to={`/status?ref=${reference}`} variant="secondary">
									View Status
								</ButtonLink>
								<Button
									variant="ghost"
									onClick={() => untrackReport(reference)}
								>
									<Trash2 size={16} />
									Remove
								</Button>
							</div>
						</Surface>
					))}
				</div>
			)}
			</div>
		</div>
	);
}
