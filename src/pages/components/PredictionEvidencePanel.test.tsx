import { fireEvent, render, screen, within } from "@testing-library/react";
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
	it("counts repeated primary detections in the headline and grouped summary", () => {
		const repeatedTires = {
			label: "tire",
			confidence: 0.6,
			confidenceBand: "low",
			advisoryText: "Human verification is required.",
			detections: [
				{ label: "tire", rawLabel: "Tire", confidence: 0.6, bbox: [0, 0, 20, 20] },
				{ label: "tire", rawLabel: "Tire", confidence: 0.58, bbox: [30, 0, 50, 20] },
				{ label: "tire", rawLabel: "Tire", confidence: 0.55, bbox: [60, 0, 80, 20] },
			],
		} as PredictionSummary;

		render(
			<PredictionEvidencePanel
				prediction={repeatedTires}
				imageUrl="blob:three-tires"
				showDetections
			/>,
		);

		const image = screen.getByRole("img", {
			name: "Evidence image with computer-vision detections",
		});
		Object.defineProperty(image, "naturalWidth", { configurable: true, value: 100 });
		Object.defineProperty(image, "naturalHeight", { configurable: true, value: 100 });
		fireEvent.load(image);

		expect(
			screen.getByRole("heading", {
				name: "3 possible tires detected. Review needed.",
			}),
		).toBeInTheDocument();
		const summary = screen.getByRole("region", { name: "Detection summary" });
		expect(within(summary).getByText("Tires")).toBeInTheDocument();
		expect(within(summary).getByText("3")).toBeInTheDocument();
		expect(document.querySelectorAll(".prediction-evidence__box")).toHaveLength(3);
	});

	it("keeps the strongest class primary while summarizing every mixed detection", () => {
		const mixedPrediction = {
			label: "tire",
			confidence: 0.92,
			confidenceBand: "high",
			advisoryText: "Final verification is still required.",
			detections: [
				{ label: "tire", rawLabel: "Tire", confidence: 0.92, bbox: [0, 0, 20, 20] },
				{ label: "artificial_container", rawLabel: "Artificial Container", confidence: 0.84, bbox: [25, 0, 45, 20] },
				{ label: "tire", rawLabel: "Tire", confidence: 0.81, bbox: [50, 0, 70, 20] },
			],
		} as PredictionSummary;

		render(
			<PredictionEvidencePanel
				prediction={mixedPrediction}
				imageUrl="blob:mixed-evidence"
				showDetections
			/>,
		);

		const image = screen.getByRole("img", {
			name: "Evidence image with computer-vision detections",
		});
		Object.defineProperty(image, "naturalWidth", { configurable: true, value: 100 });
		Object.defineProperty(image, "naturalHeight", { configurable: true, value: 100 });
		fireEvent.load(image);

		expect(
			screen.getByRole("heading", { name: "2 potential tires detected." }),
		).toBeInTheDocument();
		const summary = screen.getByRole("region", { name: "Detection summary" });
		expect(within(summary).getByText("Tires")).toBeInTheDocument();
		expect(within(summary).getByText("Artificial containers")).toBeInTheDocument();
		expect(within(summary).getByText("2")).toBeInTheDocument();
		expect(within(summary).getByText("1")).toBeInTheDocument();
		expect(document.querySelectorAll(".prediction-evidence__box")).toHaveLength(3);
	});

	it("keeps a single strongest primary object ahead of a larger secondary group", () => {
		const unevenPrediction = {
			label: "tire",
			confidence: 0.95,
			confidenceBand: "high",
			advisoryText: "Final verification is still required.",
			detections: [
				{ label: "tire", rawLabel: "Tire", confidence: 0.95, bbox: [0, 0, 20, 20] },
				{ label: "artificial_container", rawLabel: "Artificial Container", confidence: 0.8, bbox: [25, 0, 45, 20] },
				{ label: "artificial_container", rawLabel: "Artificial Container", confidence: 0.78, bbox: [50, 0, 70, 20] },
				{ label: "artificial_container", rawLabel: "Artificial Container", confidence: 0.75, bbox: [75, 0, 95, 20] },
			],
		} as PredictionSummary;

		render(<PredictionEvidencePanel prediction={unevenPrediction} />);

		expect(
			screen.getByRole("heading", { name: "Potential tire detected." }),
		).toBeInTheDocument();
		const summary = screen.getByRole("region", { name: "Detection summary" });
		const groups = within(summary).getAllByRole("listitem");
		expect(groups[0]).toHaveTextContent(/Tires\s*1/);
		expect(groups[1]).toHaveTextContent(/Artificial containers\s*3/);
	});

	it("uses raw-label aliases when canonical detection labels are absent", () => {
		render(
			<PredictionEvidencePanel
				prediction={{
					label: "artificial_container",
					confidence: 0.82,
					confidenceBand: "high",
					advisoryText: "Final verification is still required.",
					detections: [
						{ rawLabel: "Bottle", confidence: 0.82, bbox: [0, 0, 20, 20] },
						{ rawLabel: "Vase", confidence: 0.75, bbox: [30, 0, 50, 20] },
					],
				}}
			/>,
		);

		expect(
			screen.getByRole("heading", {
				name: "2 potential artificial containers detected.",
			}),
		).toBeInTheDocument();
		const summary = screen.getByRole("region", { name: "Detection summary" });
		expect(within(summary).getByText("Artificial containers")).toBeInTheDocument();
		expect(within(summary).getByText("2")).toBeInTheDocument();
	});

	it("keeps a stored primary classification when detection records are absent", () => {
		render(
			<PredictionEvidencePanel
				prediction={{
					label: "tire",
					confidence: 0.9,
					confidenceBand: "high",
					advisoryText: "Stored model result.",
					detections: [],
				}}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "Potential tire detected." }),
		).toBeInTheDocument();
		expect(screen.queryByText("No target habitat detected.")).not.toBeInTheDocument();
		expect(screen.queryByRole("region", { name: "Detection summary" })).not.toBeInTheDocument();
	});
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
						"The model produced uncertain evidence; human verification is required.",
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

	it("counts malformed detections without rendering a misleading box", () => {
		render(
			<PredictionEvidencePanel
				prediction={{
					label: "tire",
					confidence: 0.6,
					confidenceBand: "low",
					advisoryText: "Human verification is required.",
					detections: [{ rawLabel: "Tire", confidence: 0.2, bbox: [] }],
				}}
				imageUrl="blob:invalid-preview"
				showDetections
			/>,
		);

		expect(
			screen.getByText(/Some detections could not be displayed/i),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Possible tire detected. Review needed." }),
		).toBeInTheDocument();
		const summary = screen.getByRole("region", { name: "Detection summary" });
		expect(within(summary).getByText("Tires")).toBeInTheDocument();
		expect(within(summary).getByText("1")).toBeInTheDocument();
		expect(document.querySelector(".prediction-evidence__box")).toBeNull();
	});

	it("excludes unsupported legacy detections from target summaries and boxes", () => {
		const unsupportedPrediction = {
			label: "unclassified",
			confidence: null,
			confidenceBand: "low",
			advisoryText: "No retained target evidence.",
			detections: [
				{ label: null, rawLabel: "Coconut-Exocarp", confidence: 0.9, bbox: [0, 0, 20, 20] },
			],
		} as PredictionSummary;

		render(
			<PredictionEvidencePanel
				prediction={unsupportedPrediction}
				imageUrl="blob:unsupported"
				showDetections
			/>,
		);

		const image = screen.getByRole("img", {
			name: "Evidence image with computer-vision detections",
		});
		Object.defineProperty(image, "naturalWidth", { configurable: true, value: 100 });
		Object.defineProperty(image, "naturalHeight", { configurable: true, value: 100 });
		fireEvent.load(image);

		expect(
			screen.getByRole("heading", { name: "No target habitat detected." }),
		).toBeInTheDocument();
		expect(screen.queryByRole("region", { name: "Detection summary" })).not.toBeInTheDocument();
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
