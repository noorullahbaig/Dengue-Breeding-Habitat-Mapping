import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMobileViewport } from "@/app/useMobileViewport";
import { ReportStatusLookup } from "@/pages/components/ReportStatusLookup";

export function StatusPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	const isMobile = useMobileViewport();
	const reference = searchParams.get("ref") ?? "";

	useEffect(() => {
		if (isMobile && reference) {
			navigate(`/map/reports/${encodeURIComponent(reference)}`, {
				replace: true,
				state: { backTo: "/status", backLabel: "Back to search" },
			});
		}
	}, [isMobile, navigate, reference]);

	function handleSearch(nextReference: string) {
		if (isMobile) {
			navigate(`/map/reports/${encodeURIComponent(nextReference)}`, {
				state: { backTo: "/status", backLabel: "Back to search" },
			});
			return;
		}
		setSearchParams({ ref: nextReference });
	}

	return (
		<ReportStatusLookup
			reference={reference}
			onSearch={handleSearch}
			onBack={() => setSearchParams({})}
			variant="standalone"
		/>
	);
}
