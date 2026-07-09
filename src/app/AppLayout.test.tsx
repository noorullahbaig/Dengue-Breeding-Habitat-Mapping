import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/app/AppLayout";
import { MOBILE_VIEWPORT_MEDIA_QUERY } from "@/app/layoutConstants";

const navigateMock = vi.fn();
const hasReportDraftMock = vi.fn(() => false);

vi.mock("@/app/useAuth", () => ({
	useAuth: () => ({
		isAuthenticated: false,
		user: undefined,
	}),
}));

vi.mock("@/app/useReportDraft", () => ({
	useReportDraft: () => ({
		draft: undefined,
	}),
}));

vi.mock("@/app/reportOverlayState", () => ({
	hasReportDraft: (...args: unknown[]) => hasReportDraftMock(...args),
}));

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof import("react-router-dom")>(
		"react-router-dom",
	);

	return {
		...actual,
		useNavigate: () => navigateMock,
	};
});

describe("AppLayout mobile navigation clearance", () => {
	const originalVisualViewport = window.visualViewport;
	const originalInnerHeight = window.innerHeight;
	const resizeObserverObserve = vi.fn();
	const resizeObserverDisconnect = vi.fn();
	const originalResizeObserver = globalThis.ResizeObserver;

	beforeEach(() => {
		vi.clearAllMocks();
		resizeObserverObserve.mockClear();
		resizeObserverDisconnect.mockClear();
		document.documentElement.style.removeProperty(
			"--app-topbar-occupied-height",
		);
		document.documentElement.style.removeProperty(
			"--app-bottom-nav-occupied-height",
		);
		document.documentElement.style.removeProperty(
			"--visual-viewport-bottom-offset",
		);
		document.documentElement.style.removeProperty(
			"--app-mobile-bottom-clearance",
		);
		document.documentElement.style.removeProperty(
			"--app-mobile-viewport-height",
		);
		Object.defineProperty(window, "visualViewport", {
			configurable: true,
			value: {
				height: 720,
				offsetTop: 0,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		});
		Object.defineProperty(window, "innerHeight", {
			configurable: true,
			value: 800,
		});
		vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
			matches: query === MOBILE_VIEWPORT_MEDIA_QUERY,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
		globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
			observe: resizeObserverObserve,
			disconnect: resizeObserverDisconnect,
		})) as unknown as typeof ResizeObserver;
	});

	afterAll(() => {
		Object.defineProperty(window, "visualViewport", {
			configurable: true,
			value: originalVisualViewport,
		});
		Object.defineProperty(window, "innerHeight", {
			configurable: true,
			value: originalInnerHeight,
		});
		globalThis.ResizeObserver = originalResizeObserver;
	});

	it("publishes the measured mobile shell metrics", async () => {
		const getBoundingClientRectMock = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockImplementation(function mockRect() {
				if ((this as HTMLElement).classList.contains("app-topbar")) {
					return {
						x: 0,
						y: 0,
						width: 390,
						height: 56,
						top: 0,
						right: 390,
						bottom: 56,
						left: 0,
						toJSON: () => ({}),
					};
				}

				if ((this as HTMLElement).classList.contains("app-bottom-nav")) {
					return {
						x: 0,
						y: 700,
						width: 390,
						height: 100,
						top: 700,
						right: 390,
						bottom: 800,
						left: 0,
						toJSON: () => ({}),
					};
				}

				if ((this as HTMLElement).classList.contains("app-bottom-nav__report-action")) {
					return {
						x: 150,
						y: 684,
						width: 78,
						height: 68,
						top: 684,
						right: 228,
						bottom: 752,
						left: 150,
						toJSON: () => ({}),
					};
				}

				return {
					x: 0,
					y: 0,
					width: 0,
					height: 0,
					top: 0,
					right: 0,
					bottom: 0,
					left: 0,
					toJSON: () => ({}),
				};
			});

		render(
			<MemoryRouter initialEntries={["/map"]}>
				<Routes>
					<Route element={<AppLayout />}>
						<Route path="/map" element={<div>map page</div>} />
					</Route>
				</Routes>
			</MemoryRouter>,
		);

		expect(
			screen.getByRole("navigation", { name: "Primary mobile navigation" }),
		).toBeInTheDocument();
		expect(window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).media).toBe(
			MOBILE_VIEWPORT_MEDIA_QUERY,
		);

		await waitFor(() => {
			expect(
				document.documentElement.style.getPropertyValue(
					"--app-topbar-occupied-height",
				),
			).toBe("56px");
			expect(
				document.documentElement.style.getPropertyValue(
					"--app-bottom-nav-occupied-height",
				),
			).toBe("116px");
			expect(
				document.documentElement.style.getPropertyValue(
					"--visual-viewport-bottom-offset",
				),
			).toBe("80px");
			expect(
				document.documentElement.style.getPropertyValue(
					"--app-mobile-bottom-clearance",
				),
			).toBe("196px");
			expect(
				document.documentElement.style.getPropertyValue(
					"--app-mobile-viewport-height",
				),
			).toBe("800px");
		});

		expect(globalThis.ResizeObserver).toHaveBeenCalled();
		expect(resizeObserverObserve).toHaveBeenCalledTimes(2);

		getBoundingClientRectMock.mockRestore();
	});

	it("treats hidden shell chrome as zero occupied space", async () => {
		const getBoundingClientRectMock = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockImplementation(() => ({
				x: 0,
				y: 0,
				width: 0,
				height: 0,
				top: 0,
				right: 0,
				bottom: 0,
				left: 0,
				toJSON: () => ({}),
			}));

		render(
			<MemoryRouter initialEntries={["/map"]}>
				<Routes>
					<Route element={<AppLayout />}>
						<Route path="/map" element={<div>map page</div>} />
					</Route>
				</Routes>
			</MemoryRouter>,
		);

		await waitFor(() => {
			expect(
				document.documentElement.style.getPropertyValue(
					"--app-topbar-occupied-height",
				),
			).toBe("0px");
			expect(
				document.documentElement.style.getPropertyValue(
					"--app-bottom-nav-occupied-height",
				),
			).toBe("0px");
			expect(
				document.documentElement.style.getPropertyValue(
					"--app-mobile-bottom-clearance",
				),
			).toBe("80px");
		});

		getBoundingClientRectMock.mockRestore();
	});
});
