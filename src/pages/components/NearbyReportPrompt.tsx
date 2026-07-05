import { StatusBadge } from "@/features/shared/StatusBadge";
import { formatHabitatLabel, formatTimestamp } from "@/lib/formatters";
import type { NearbyReportCandidate } from "@/types/report";
import { Dialog, SectionHeader, Surface, Button } from "@/components/ui";

interface NearbyReportPromptProps {
	candidates: NearbyReportCandidate[];
	onStack: (reference: string) => void;
	onCreateSeparate: () => void;
	onDismiss?: () => void;
	variant?: "modal" | "inline";
}

export function NearbyReportPrompt({
	candidates,
	onStack,
	onCreateSeparate,
	onDismiss,
	variant = "modal",
}: NearbyReportPromptProps) {
	const content = (
		<div className="stack-lg">
			<div className="nearby-list stack-md">
				{candidates.map((candidate) => (
					<article className="nearby-card" key={candidate.reference}>
						<img
							src={candidate.thumbnailUrl}
							alt={`Annotated evidence for nearby report ${candidate.reference}`}
							className="nearby-card__image"
						/>
						<div className="nearby-card__body">
							<div className="cluster-row cluster-row--between">
								<strong>
									{formatHabitatLabel(candidate.habitatClass)}
								</strong>
								<StatusBadge status={candidate.status} />
							</div>

							<div className="nearby-card__meta">
								<span>
									<svg
										aria-hidden="true"
										viewBox="0 0 24 24"
										width="14"
										height="14"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
										<circle cx="12" cy="10" r="3" />
									</svg>
									{Math.round(candidate.distanceMeters)}m away
								</span>
								<span>
									<svg
										aria-hidden="true"
										viewBox="0 0 24 24"
										width="14"
										height="14"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
										<line x1="16" y1="2" x2="16" y2="6" />
										<line x1="8" y1="2" x2="8" y2="6" />
										<line x1="3" y1="10" x2="21" y2="10" />
									</svg>
									{formatTimestamp(candidate.latestReportedAt)}
								</span>
								<span>
									<svg
										aria-hidden="true"
										viewBox="0 0 24 24"
										width="14"
										height="14"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
										<circle cx="9" cy="7" r="4" />
										<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
										<path d="M16 3.13a4 4 0 0 1 0 7.75" />
									</svg>
									{candidate.reportCount === 1
										? "1 report"
										: `${candidate.reportCount} reports`}
								</span>
							</div>

							<Button
								variant="primary"
								fullWidth
								onClick={() => onStack(candidate.reference)}
							>
								Add to this report
							</Button>
						</div>
					</article>
				))}
			</div>

			{variant === "inline" ? (
				<div className="u-static-65f9d5a3">
					<Button
						variant="secondary"
						fullWidth
						onClick={onCreateSeparate}
					>
						Create separate report
					</Button>
				</div>
			) : null}
		</div>
	);

	if (variant === "inline") {
		return (
			<Surface as="section" className="nearby-panel">
				<SectionHeader title="We found a similar report nearby" />
				{content}
			</Surface>
		);
	}

	return (
		<Dialog
			open
			title="We found a similar report nearby"
			onClose={onDismiss ?? onCreateSeparate}
			className="nearby-modal animate-rise"
			actions={(
				<Button variant="secondary" fullWidth onClick={onCreateSeparate}>
					Create separate report
				</Button>
			)}
		>
			{content}
		</Dialog>
	);
}
