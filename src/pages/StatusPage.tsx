import { useSearchParams } from "react-router-dom";
import { ReportStatusLookup } from "@/pages/components/ReportStatusLookup";

export function StatusPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const reference = searchParams.get("ref") ?? "";

	return (
		<ReportStatusLookup
			reference={reference}
			onSearch={(nextReference) => setSearchParams({ ref: nextReference })}
			onBack={() => setSearchParams({})}
			variant="standalone"
		/>
	);
}
