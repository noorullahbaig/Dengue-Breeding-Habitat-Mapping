import { fireEvent, render, screen } from "@testing-library/react";
import { PredictionEvidencePanel } from "@/pages/components/PredictionEvidencePanel";
import type { PredictionSummary } from "@/types/report";

const prediction: PredictionSummary = {
	label: "artificial_container",
	confidenceBand: "moderate",
	advisoryText: "Advisory only.",
	detections: [
		{
			rawLabel: "artificial_container",
			confidence: 0.91,
			bbox: [10, 20, 160, 180],
			bboxNormalized: [0.1, 0.2, 0.6, 0.7],
		},
	],
};

describe("PredictionEvidencePanel", () => {
	it("renders a nearby decision inside the existing inference result body", () => {
		render(
			<PredictionEvidencePanel
				prediction={prediction}
				decision={{ kind: "stack", reference: "KL-STACK-0001" }}
			/>,
		);

		const decision = document.querySelector(".prediction-evidence__decision");
		expect(decision).toHaveAttribute("data-decision", "stack");
		expect(screen.getByText("Added to nearby report")).toBeInTheDocument();
		expect(screen.getByText("KL-STACK-0001")).toBeInTheDocument();
	});

	it("renders a separate-report decision using the inference result status treatment", () => {
		render(
			<PredictionEvidencePanel
				prediction={prediction}
				decision={{ kind: "separate" }}
			/>,
		);

		const decision = document.querySelector(".prediction-evidence__decision");
		expect(decision).toHaveAttribute("data-decision", "separate");
		expect(screen.getByText("Separate report selected")).toBeInTheDocument();
		expect(
			screen.getByText("This photo will be submitted as a new report."),
		).toBeInTheDocument();
	});

	it("renders the preview image and contained normalized bounding boxes after load", () => {
		render(
			<PredictionEvidencePanel
				prediction={prediction}
				imageUrl="blob:preview"
				imageAlt="Submitted evidence preview"
				showDetections
			/>,
		);

		const image = screen.getByRole("img", {
			name: "Submitted evidence preview",
		});
		Object.defineProperty(image, "naturalWidth", {
			configurable: true,
			value: 1200,
		});
		Object.defineProperty(image, "naturalHeight", {
			configurable: true,
			value: 900,
		});

		fireEvent.load(image);

		const box = document.querySelector(".prediction-evidence__box");
		expect(box).not.toBeNull();
		expect(box).toHaveStyle({ left: "10%", top: "20%", width: "50%" });
		expect(Number.parseFloat(box?.style.height ?? "0")).toBeCloseTo(50, 3);
		expect(
			document.querySelector(".prediction-evidence__media-frame"),
		).toHaveStyle({
			aspectRatio: "1200 / 900",
		});
	});

	it("keeps the same evidence image mounted while analysis transitions into the result", () => {
		const { rerender } = render(
			<PredictionEvidencePanel
				prediction={prediction}
				imageUrl="blob:preview"
				imageAlt="Submitted evidence preview"
				showDetections
				isAnalyzing
			/>,
		);

		const image = screen.getByRole("img", {
			name: "Submitted evidence preview",
		});
		expect(screen.getByText("Analyzing evidence")).toBeInTheDocument();

		Object.defineProperty(image, "naturalWidth", {
			configurable: true,
			value: 1200,
		});
		Object.defineProperty(image, "naturalHeight", {
			configurable: true,
			value: 900,
		});
		fireEvent.load(image);
		rerender(
			<PredictionEvidencePanel
				prediction={{ ...prediction, confidenceBand: "high" }}
				imageUrl="blob:preview"
				imageAlt="Submitted evidence preview"
				showDetections
			/>,
		);

		expect(
			screen.getByRole("img", { name: "Submitted evidence preview" }),
		).toBe(image);
		expect(
			screen.getByRole("heading", {
				name: "Potential artificial container detected.",
			}),
		).toBeInTheDocument();
		expect(document.querySelector(".prediction-evidence__box")).not.toBeNull();
	});

	it("shows a visible failure state when the preview image cannot load", () => {
		render(
			<PredictionEvidencePanel
				prediction={prediction}
				imageUrl="blob:missing-preview"
				imageAlt="Submitted evidence preview"
				showDetections
			/>,
		);

		const image = screen.getByRole("img", {
			name: "Submitted evidence preview",
		});
		fireEvent.error(image);

		expect(screen.getByText("Photo preview unavailable")).toBeInTheDocument();
		expect(
			screen.getByText(/The image could not be loaded/i),
		).toBeInTheDocument();
	});

	it("shows a visible failure state when authenticated evidence could not be downloaded", () => {
		render(
			<PredictionEvidencePanel
				prediction={prediction}
				imageUnavailable
				showDetections
			/>,
		);

		expect(screen.getByText("Photo preview unavailable")).toBeInTheDocument();
		expect(screen.getByText(/The image could not be loaded/i)).toBeInTheDocument();
	});

	it("keeps the result summary visible when no detections are returned", () => {
		render(
			<PredictionEvidencePanel
				prediction={{
					label: "unclassified",
					confidence: null,
					confidenceBand: "low",
					advisoryText:
						"The image is ambiguous; human verification is required.",
					detections: [],
				}}
				imageUrl="blob:empty-preview"
				showDetections
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "No target habitat detected." }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/No target habitat was identified in this photo/i),
		).toBeInTheDocument();
	});

	it("reports malformed detections without rendering a misleading box", () => {
		render(
			<PredictionEvidencePanel
				prediction={{
					...prediction,
					confidenceBand: "low",
					detections: [{ rawLabel: "Tire", confidence: 0.2, bbox: [] }],
				}}
				imageUrl="blob:invalid-preview"
				showDetections
			/>,
		);

		expect(
			screen.getByText(/Some detections could not be displayed/i),
		).toBeInTheDocument();
		expect(document.querySelector(".prediction-evidence__box")).toBeNull();
	});

	it("uses plain-language outcome states without exposing model confidence numbers", () => {
		render(
			<PredictionEvidencePanel
				prediction={{ ...prediction, confidenceBand: "high" }}
			/>,
		);
		expect(
			screen.getByRole("heading", {
				name: "Potential artificial container detected.",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("Detected")).toBeInTheDocument();
		expect(screen.queryByText(/91%/)).toBeNull();
	});
});
