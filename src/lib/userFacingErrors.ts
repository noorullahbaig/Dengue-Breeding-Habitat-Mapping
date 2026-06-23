export function toPublicReportErrorMessage(error: unknown) {
	if (error instanceof Error && /not found/i.test(error.message)) {
		return "No public report was found for this reference.";
	}

	return "Public report details are temporarily unavailable. Return to the map and try again.";
}
