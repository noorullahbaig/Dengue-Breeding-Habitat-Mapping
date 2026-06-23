import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CircleUserRound, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/app/useAuth";
import {
	Button,
	ButtonLink,
	DefinitionGrid,
	DefinitionItem,
	FormField,
	MetaLabel,
	Notice,
	Surface,
} from "@/components/ui";

export function ProfilePageV2() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const {
		isAuthenticated,
		providerTarget,
		sessionMode,
		signIn,
		signOut,
		trackReport,
		trackedReferences,
		user,
	} = useAuth();
	const [email, setEmail] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [feedback, setFeedback] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const attachRef = searchParams.get("attachRef")?.trim().toUpperCase() ?? "";
	const redirectPath = searchParams.get("redirect") ?? "/activity";
	const mode = searchParams.get("mode") ?? "";

	useEffect(() => {
		if (!isAuthenticated || !attachRef) {
			return;
		}

		trackReport(attachRef);
		setFeedback(`Saved ${attachRef} to your activity.`);

		const nextParams = new URLSearchParams(searchParams);
		nextParams.delete("attachRef");
		nextParams.delete("mode");
		setSearchParams(nextParams, { replace: true });
	}, [attachRef, isAuthenticated, searchParams, setSearchParams, trackReport]);

	async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);

		try {
			await signIn({ email, displayName });

			if (attachRef) {
				trackReport(attachRef);
				navigate("/activity", {
					replace: true,
					state: { feedback: `Saved ${attachRef} to your activity.` },
				});
				return;
			}

			navigate(redirectPath, { replace: true });
		} finally {
			setIsSubmitting(false);
		}
	}

	function handleSignOut() {
		signOut();
		setFeedback("Signed out. Anonymous reporting is still available.");
	}

	const sessionNote =
		sessionMode === "cognito"
			? "Activity syncs across your devices."
			: providerTarget === "cognito"
				? "Account sync not connected — activity stays on this device."
				: "Activity stays on this device.";

	return (
		<div className="page-layout page--auth">
			{!isAuthenticated ? (
				<Surface as="section" className="auth-panel">
					{/* Icon + Heading */}
					<div className="auth-panel__brand">
						<div className="auth-panel__icon-wrap">
							<CircleUserRound size={26} />
						</div>
						<div>
							<MetaLabel>
								{mode === "signin" ? "Optional Sign In" : "Resident Profile"}
							</MetaLabel>
							<h1 className="auth-panel__title">
								{attachRef
									? `Sign in to save report ${attachRef}`
									: "Sign in to save and follow your reports."}
							</h1>
						</div>
					</div>

					<p className="auth-panel__body">
						Reporting is always open to everyone — sign in only if you want to
						privately track selected submissions.
					</p>

					{/* Single session notice */}
					<Notice tone="info" className="auth-inline-note">
						{sessionNote}
					</Notice>

					<form className="auth-form stack-md" onSubmit={handleSignIn}>
						<FormField label="Email address" required>
							<input
								id="auth-email"
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								autoComplete="email"
								placeholder="name@example.com"
								required
							/>
						</FormField>

						<FormField
							label="Display name"
							hint="(optional) How your activity will be labelled"
						>
							<input
								id="auth-name"
								type="text"
								value={displayName}
								onChange={(event) => setDisplayName(event.target.value)}
								autoComplete="name"
								placeholder="Jane Doe"
							/>
						</FormField>

						<Button type="submit" fullWidth disabled={isSubmitting}>
							<ShieldCheck size={18} />
							{isSubmitting ? "Signing in…" : "Continue to sign in"}
						</Button>
					</form>
				</Surface>
			) : (
				<Surface as="section" className="auth-panel auth-panel--signed-in">
					{/* Signed-in header */}
					<div className="auth-panel__signed-header">
						<div className="auth-panel__avatar">
							{user?.displayName?.charAt(0)?.toUpperCase() ?? "U"}
						</div>
						<div>
							<MetaLabel>Resident profile</MetaLabel>
							<h1 className="auth-panel__title">{user?.displayName}</h1>
							<p className="auth-panel__email">{user?.email}</p>
						</div>
					</div>

					{feedback ? (
						<Notice tone="success" className="auth-inline-note">
							{feedback}
						</Notice>
					) : null}

					<DefinitionGrid className="auth-profile-grid">
						<DefinitionItem label="Saved reports">
							{trackedReferences.length}
						</DefinitionItem>
						<DefinitionItem label="Storage">
							{user?.provider === "cognito" ? "Connected account" : "This browser"}
						</DefinitionItem>
					</DefinitionGrid>

					{user?.provider === "local" ? (
						<Notice tone="info" className="auth-inline-note">
							Your saved activity is stored on this device only.
						</Notice>
					) : null}

					<div className="auth-panel__actions">
						<ButtonLink to="/activity" fullWidth>View My Activity</ButtonLink>
						<Button variant="ghost" fullWidth onClick={handleSignOut}>
							<LogOut size={18} />
							Sign Out
						</Button>
					</div>
				</Surface>
			)}
		</div>
	);
}
