import { useState, useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

const MAX_NOTE_LENGTH = 150;

interface LowConfidenceWarningSheetProps {
	onConfirm: (note: string) => void;
	onCancel: () => void;
	onRetake: () => void;
}

export function LowConfidenceWarningSheet({
	onConfirm,
	onCancel,
	onRetake,
}: LowConfidenceWarningSheetProps) {
	const [note, setNote] = useState("");
	const [isClosing, setIsClosing] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Trap focus inside the sheet for accessibility
	useEffect(() => {
		const previous = document.activeElement as HTMLElement | null;
		textareaRef.current?.focus();
		return () => {
			previous?.focus();
		};
	}, []);

	// Close on Escape
	useEffect(() => {
		function handleKey(event: KeyboardEvent) {
			if (event.key === "Escape") handleCancel();
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	});

	function handleCancel() {
		setIsClosing(true);
		setTimeout(onCancel, 220);
	}

	function handleConfirm() {
		setIsClosing(true);
		setTimeout(() => onConfirm(note.trim()), 220);
	}

	function handleRetake() {
		setIsClosing(true);
		setTimeout(onRetake, 220);
	}

	const charsLeft = MAX_NOTE_LENGTH - note.length;
	const isNearLimit = charsLeft <= 30;

	return (
		<div className={`lc-sheet-backdrop${isClosing ? " lc-sheet-backdrop--closing" : ""}`}>
			<button
				type="button"
				className="lc-sheet-backdrop__dismiss"
				aria-label="Close low-confidence review"
				onClick={handleCancel}
			/>
			<div
				className={`lc-sheet${isClosing ? " lc-sheet--closing" : ""}`}
				role="dialog"
				aria-modal="true"
				aria-labelledby="lc-sheet-heading"
			>
				{/* Header row */}
				<div className="lc-sheet__header">
					<div className="lc-sheet__icon-wrap" aria-hidden="true">
						<AlertTriangle className="lc-sheet__icon" />
					</div>
					<button
						type="button"
						className="lc-sheet__close"
						aria-label="Dismiss warning"
						onClick={handleCancel}
					>
						<X size={18} />
					</button>
				</div>

				{/* Copy */}
				<h2 id="lc-sheet-heading" className="lc-sheet__heading">
					No target habitat detected
				</h2>
				<p className="lc-sheet__body">
					No known breeding habitat was recognized in this photo. You can still submit your report to the public evidence map by adding a brief optional note about what you observed.
				</p>

				{/* Optional note */}
				<div className="lc-sheet__note-wrap">
					<textarea
						ref={textareaRef}
						id="lc-sheet-note"
						className="lc-sheet__textarea"
						placeholder="e.g. Stagnant water under the drain cover…"
						maxLength={MAX_NOTE_LENGTH}
						rows={3}
						value={note}
						onChange={(e) => setNote(e.target.value)}
						aria-label="Optional note about this report"
					/>
					<p
						className={`lc-sheet__char-count${isNearLimit ? " lc-sheet__char-count--warn" : ""}`}
						aria-live="polite"
					>
						{charsLeft} characters remaining
					</p>
				</div>

				{/* Actions */}
				<div className="lc-sheet__actions">
					<button
						type="button"
						id="lc-sheet-confirm"
						className="lc-sheet__btn lc-sheet__btn--primary"
						onClick={handleConfirm}
					>
						Submit anyway
					</button>
					<button
						type="button"
						id="lc-sheet-cancel"
						className="lc-sheet__btn lc-sheet__btn--secondary"
						onClick={handleRetake}
					>
						Retake photo
					</button>
				</div>
			</div>
		</div>
	);
}
