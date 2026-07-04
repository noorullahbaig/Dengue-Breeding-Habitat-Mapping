import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
	CircleUserRound,
	LogOut,
	Mail,
	ClipboardList,
} from "lucide-react";
import { useAuth } from "@/app/useAuth";
import "@/styles/profile.css";

export function ProfilePage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const {
		isAuthenticated,
		signOut,
		signInWithGoogle,
		signInWithHostedUI,
		trackReport,
		trackedReferences,
		user,
	} = useAuth();

	const [mounted, setMounted] = useState(false);
	const [feedback, setFeedback] = useState("");
	const [error, setError] = useState("");

	const attachRef = searchParams.get("attachRef")?.trim().toUpperCase() ?? "";
	const redirectPath = searchParams.get("redirect") ?? "/activity";

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!isAuthenticated || !attachRef) {
			return;
		}

		trackReport(attachRef);
		setFeedback(`Report ${attachRef} saved to your activity.`);

		const nextParams = new URLSearchParams(searchParams);
		nextParams.delete("attachRef");
		nextParams.delete("mode");
		setSearchParams(nextParams, { replace: true });
	}, [attachRef, isAuthenticated, searchParams, setSearchParams, trackReport]);

	function handleSignOut() {
		signOut();
		setFeedback("Signed out. Anonymous reporting is still available.");
	}

	async function handleGoogleSignIn() {
		setError("");
		try {
			let finalRedirect = redirectPath;
			if (attachRef) {
				finalRedirect = `/profile?mode=signin&attachRef=${attachRef}&redirect=${encodeURIComponent(redirectPath)}`;
			}
			await signInWithGoogle(finalRedirect);
		} catch {
			setError("Failed to initiate Google Sign-In. Please try again.");
		}
	}

	async function handleEmailSignIn() {
		setError("");
		try {
			let finalRedirect = redirectPath;
			if (attachRef) {
				finalRedirect = `/profile?mode=signin&attachRef=${attachRef}&redirect=${encodeURIComponent(redirectPath)}`;
			}
			await signInWithHostedUI(finalRedirect);
		} catch {
			setError("Failed to initiate Email Sign-In. Please try again.");
		}
	}

	return (
		<div className={`profile-page ${mounted ? "profile-page--mounted" : ""}`}>
			{/* Decorative background */}
			<div className="profile-bg" aria-hidden="true">
				<div className="profile-bg__orb profile-bg__orb--1" />
				<div className="profile-bg__orb profile-bg__orb--2" />
				<div className="profile-bg__orb profile-bg__orb--3" />
				<div className="profile-bg__grid" />
			</div>

			<div className="profile-scroll">
				{!isAuthenticated ? (
					/* ── NOT SIGNED IN ── */
					<main className="profile-card">
						{/* Top content — centred in the upper half */}
						<div className="profile-card-top">
							<div className="profile-avatar-wrap">
								<div className="profile-avatar-circle">
									<CircleUserRound size={30} />
								</div>
							</div>

							<h1 className="profile-card__title">
								{attachRef
									? `Save report ${attachRef}`
									: "Sign in to track your reports"}
							</h1>
							<p className="profile-card__sub">
								{attachRef
									? "Attach this report to follow its status privately."
									: "Private updates on every report you submit."}
							</p>

							{/* Error alert */}
							{error && (
								<div className="profile-alert profile-alert--error" role="alert">
									<span className="profile-alert__dot" />
									{error}
								</div>
							)}
						</div>

						{/* Buttons pinned at bottom */}
						<div className="profile-auth-actions">
							{/* Google */}
							<button
								type="button"
								className="profile-google-btn"
								onClick={handleGoogleSignIn}
							>
								<svg
									viewBox="0 0 24 24"
									width="20"
									height="20"
									xmlns="http://www.w3.org/2000/svg"
									aria-hidden="true"
								>
									<path
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
										fill="#4285F4"
									/>
									<path
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										fill="#34A853"
									/>
									<path
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										fill="#FBBC05"
									/>
									<path
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										fill="#EA4335"
									/>
								</svg>
								Continue with Google
							</button>

							<div className="profile-divider">
								<span>or</span>
							</div>

							{/* Email */}
							<button
								type="button"
								className="profile-primary-btn"
								onClick={handleEmailSignIn}
							>
								<Mail size={18} />
								Continue with Email
							</button>

							<p className="profile-anon-note">
								Reporting is always open without an account.
							</p>
						</div>
					</main>
				) : (
					/* ── SIGNED IN ── */
					<main className="profile-card">
						{/* Feedback banner */}
						{feedback && (
							<div
								className="profile-alert profile-alert--success"
								role="status"
							>
								<span className="profile-alert__dot" />
								{feedback}
							</div>
						)}

						{/* Signed-in header */}
						<div className="profile-signed-header">
							<div className="profile-signed-avatar" aria-hidden="true">
								{user?.photoUrl ? (
									<img src={user.photoUrl} alt="" />
								) : (
									user?.displayName?.charAt(0)?.toUpperCase() ?? "U"
								)}
							</div>
							<div className="profile-signed-meta">
								<p className="profile-signed-eyebrow">Resident profile</p>
								<h1 className="profile-signed-name">
									{user?.displayName ?? "Resident"}
								</h1>
								<p className="profile-signed-email">{user?.email}</p>
							</div>
						</div>

						{/* Stats strip */}
						<ul className="profile-stats" aria-label="Account stats">
							<li className="profile-stat-card profile-stat-card--accent">
								<span className="profile-stat-card__label">Reports</span>
								<span className="profile-stat-card__value">
									{trackedReferences.length}
								</span>
								<span className="profile-stat-card__sub">saved</span>
							</li>
						</ul>

						<div className="profile-section-rule" />

						{/* Actions — pushed to bottom via flex */}
						<div className="profile-signed-actions">
							<Link to="/activity" className="profile-primary-btn">
								<ClipboardList size={18} />
								View My Reports
							</Link>
							<button
								type="button"
								className="profile-ghost-btn"
								onClick={handleSignOut}
							>
								<LogOut size={16} />
								Sign Out
							</button>
						</div>
					</main>
				)}
			</div>
		</div>
	);
}
