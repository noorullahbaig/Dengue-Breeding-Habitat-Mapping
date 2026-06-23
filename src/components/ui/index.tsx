import {
	Children,
	cloneElement,
	isValidElement,
	useEffect,
	useId,
	useRef,
	type ButtonHTMLAttributes,
	type ElementType,
	type HTMLAttributes,
	type InputHTMLAttributes,
	type KeyboardEvent,
	type PropsWithChildren,
	type ReactElement,
	type ReactNode,
} from "react";
import { Link, type LinkProps } from "react-router-dom";

function classes(...values: Array<string | false | null | undefined>) {
	return values.filter(Boolean).join(" ");
}

type SurfaceTone = "default" | "muted" | "highlight";
type SurfacePadding = "none" | "compact" | "default" | "spacious";
type SurfaceElevation = "flat" | "raised";

interface SurfaceProps extends PropsWithChildren, HTMLAttributes<HTMLElement> {
	as?: "div" | "section" | "article" | "aside" | "header" | "main";
	tone?: SurfaceTone;
	padding?: SurfacePadding;
	elevation?: SurfaceElevation;
}

export function Surface({
	as: Component = "div",
	tone = "default",
	padding = "default",
	elevation = "raised",
	className,
	children,
	...props
}: SurfaceProps) {
	return (
		<Component
			className={classes(
				"ui-surface",
				`ui-surface--${tone}`,
				`ui-surface--padding-${padding}`,
				`ui-surface--${elevation}`,
				className,
			)}
			{...props}
		>
			{children}
		</Component>
	);
}

export type ButtonVariant =
	| "primary"
	| "secondary"
	| "ghost"
	| "subtle"
	| "danger";
export type ButtonSize =
	| "compact"
	| "standard"
	| "large"
	| "small"
	| "medium";

interface ButtonStyleProps {
	variant?: ButtonVariant;
	size?: ButtonSize;
	fullWidth?: boolean;
}

function buttonClassName({
	variant = "primary",
	size = "standard",
	fullWidth = false,
	className,
}: ButtonStyleProps & { className?: string }) {
	const normalizedSize =
		size === "small" ? "compact" : size === "medium" ? "standard" : size;

	return classes(
		"ui-button",
		`ui-button--${variant}`,
		`ui-button--${normalizedSize}`,
		fullWidth && "ui-button--full",
		className,
	);
}

export function Button({
	variant,
	size,
	fullWidth,
	className,
	type = "button",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps) {
	return (
		<button
			type={type}
			className={buttonClassName({ variant, size, fullWidth, className })}
			{...props}
		/>
	);
}

export function ButtonLink({
	variant,
	size,
	fullWidth,
	className,
	...props
}: LinkProps & ButtonStyleProps) {
	return (
		<Link
			className={buttonClassName({ variant, size, fullWidth, className })}
			{...props}
		/>
	);
}

export function IconButton({
	className,
	type = "button",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type={type}
			className={classes("ui-icon-button", className)}
			{...props}
		/>
	);
}

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";
type BadgeSize = "small" | "medium";

interface BadgeProps
	extends PropsWithChildren,
		HTMLAttributes<HTMLSpanElement> {
	tone?: BadgeTone;
	size?: BadgeSize;
}

export function Badge({
	tone = "neutral",
	size = "medium",
	className,
	...props
}: BadgeProps) {
	return (
		<span
			className={classes(
				"ui-badge",
				`ui-badge--${tone}`,
				`ui-badge--${size}`,
				className,
			)}
			{...props}
		/>
	);
}

type NoticeTone = "neutral" | "info" | "success" | "warning" | "error";

interface NoticeProps
	extends PropsWithChildren,
		HTMLAttributes<HTMLDivElement> {
	tone?: NoticeTone;
	title?: string;
	icon?: ReactNode;
	live?: boolean;
}

export function Notice({
	tone = "neutral",
	title,
	icon,
	live = false,
	className,
	children,
	...props
}: NoticeProps) {
	return (
		<div
			className={classes("ui-notice", `ui-notice--${tone}`, className)}
			role={live ? "status" : undefined}
			aria-live={live ? "polite" : undefined}
			{...props}
		>
			{icon ? <span className="ui-notice__icon">{icon}</span> : null}
			<div className="ui-notice__content">
				{title ? <strong className="ui-notice__title">{title}</strong> : null}
				<div className="ui-notice__body">{children}</div>
			</div>
		</div>
	);
}

export function MetaLabel({
	className,
	...props
}: HTMLAttributes<HTMLSpanElement>) {
	return <span className={classes("ui-meta-label", className)} {...props} />;
}

interface HeaderProps extends HTMLAttributes<HTMLElement> {
	eyebrow?: string;
	title: string;
	description?: string;
	actions?: ReactNode;
	titleAs?: "h1" | "h2" | "h3";
	compact?: boolean;
}

function Header({
	eyebrow,
	title,
	description,
	actions,
	titleAs = "h2",
	compact = false,
	className,
	...props
}: HeaderProps) {
	const Title = titleAs as ElementType;
	return (
		<header
			className={classes(
				"ui-header",
				compact && "ui-header--compact",
				className,
			)}
			{...props}
		>
			<div className="ui-header__copy">
				{eyebrow ? <MetaLabel>{eyebrow}</MetaLabel> : null}
				<Title className="ui-header__title">{title}</Title>
				{description ? (
					<p className="ui-header__description">{description}</p>
				) : null}
			</div>
			{actions ? <div className="ui-header__actions">{actions}</div> : null}
		</header>
	);
}

export function PageHeader(props: Omit<HeaderProps, "titleAs">) {
	return <Header titleAs="h1" {...props} />;
}

export function SectionHeader(
	props: Omit<HeaderProps, "titleAs"> & { titleAs?: "h2" | "h3" },
) {
	return <Header titleAs={props.titleAs ?? "h2"} {...props} />;
}

interface DefinitionGridProps
	extends PropsWithChildren,
		HTMLAttributes<HTMLDListElement> {
	columns?: 1 | 2 | 3 | 4;
}

export function DefinitionGrid({
	columns = 2,
	className,
	...props
}: DefinitionGridProps) {
	return (
		<dl
			className={classes(
				"ui-definition-grid",
				`ui-definition-grid--${columns}`,
				className,
			)}
			{...props}
		/>
	);
}

interface DefinitionItemProps
	extends PropsWithChildren,
		HTMLAttributes<HTMLDivElement> {
	label: string;
}

export function DefinitionItem({
	label,
	className,
	children,
	...props
}: DefinitionItemProps) {
	return (
		<div className={classes("ui-definition-item", className)} {...props}>
			<dt>
				<MetaLabel>{label}</MetaLabel>
			</dt>
			<dd>{children}</dd>
		</div>
	);
}

type FieldControlProps = InputHTMLAttributes<HTMLInputElement> & {
	id?: string;
	"aria-describedby"?: string;
};

interface FormFieldProps extends PropsWithChildren {
	label: string;
	hint?: string;
	error?: string;
	required?: boolean;
	className?: string;
}

export function FormField({
	label,
	hint,
	error,
	required = false,
	className,
	children,
}: FormFieldProps) {
	const generatedId = useId();
	const control = Children.only(children);

	if (!isValidElement(control)) {
		throw new Error("FormField expects one form control child.");
	}

	const typedControl = control as ReactElement<FieldControlProps>;
	const controlId = typedControl.props.id ?? `${generatedId}-control`;
	const hintId = hint ? `${generatedId}-hint` : undefined;
	const errorId = error ? `${generatedId}-error` : undefined;
	const describedBy =
		[typedControl.props["aria-describedby"], hintId, errorId]
			.filter(Boolean)
			.join(" ") || undefined;

	return (
		<div className={classes("ui-field", error && "ui-field--error", className)}>
			<label className="ui-field__label" htmlFor={controlId}>
				{label}
				{required ? <span aria-hidden="true"> *</span> : null}
			</label>
			{cloneElement(typedControl, {
				id: controlId,
				className: classes("ui-field__control", typedControl.props.className),
				required,
				"aria-invalid": error ? true : undefined,
				"aria-describedby": describedBy,
			})}
			{hint ? (
				<span className="ui-field__hint" id={hintId}>
					{hint}
				</span>
			) : null}
			{error ? (
				<span className="ui-field__error" id={errorId}>
					{error}
				</span>
			) : null}
		</div>
	);
}

interface EmptyStateProps
	extends PropsWithChildren,
		HTMLAttributes<HTMLDivElement> {
	title: string;
	icon?: ReactNode;
	actions?: ReactNode;
	compact?: boolean;
}

export function EmptyState({
	title,
	icon,
	actions,
	compact = false,
	className,
	children,
	...props
}: EmptyStateProps) {
	return (
		<div
			className={classes(
				"ui-state",
				"ui-empty-state",
				compact && "ui-state--compact",
				className,
			)}
			{...props}
		>
			{icon ? <div className="ui-state__icon">{icon}</div> : null}
			<h2 className="ui-state__title">{title}</h2>
			<div className="ui-state__body">{children}</div>
			{actions ? <div className="ui-state__actions">{actions}</div> : null}
		</div>
	);
}

interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
	label: string;
	compact?: boolean;
}

export function LoadingState({
	label,
	compact = false,
	className,
	...props
}: LoadingStateProps) {
	return (
		<div
			className={classes(
				"ui-state",
				"ui-loading-state",
				compact && "ui-state--compact",
				className,
			)}
			role="status"
			aria-live="polite"
			{...props}
		>
			<span className="ui-loading-state__indicator" aria-hidden="true" />
			<span>{label}</span>
		</div>
	);
}

interface MapFrameProps
	extends PropsWithChildren,
		HTMLAttributes<HTMLDivElement> {
	label: string;
	banner?: ReactNode;
	controls?: ReactNode;
	height?: "compact" | "default" | "immersive";
	interactive?: boolean;
}

export function MapFrame({
	label,
	banner,
	controls,
	height = "default",
	interactive = true,
	className,
	children,
	...props
}: MapFrameProps) {
	return (
		<section
			className={classes(
				"ui-map-frame",
				`ui-map-frame--${height}`,
				!interactive && "ui-map-frame--static",
				className,
			)}
			aria-label={label}
			{...props}
		>
			{banner ? <div className="ui-map-frame__banner">{banner}</div> : null}
			<div className="ui-map-frame__canvas">{children}</div>
			{controls ? (
				<div className="ui-map-frame__controls">{controls}</div>
			) : null}
		</section>
	);
}

interface DialogProps extends PropsWithChildren {
	open: boolean;
	title: string;
	onClose: () => void;
	description?: string;
	className?: string;
	actions?: ReactNode;
}

export function Dialog({
	open,
	title,
	onClose,
	description,
	className,
	actions,
	children,
}: DialogProps) {
	const titleId = useId();
	const descriptionId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!open) return;

		previousFocusRef.current = document.activeElement as HTMLElement | null;
		const frame = window.requestAnimationFrame(() => {
			const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			firstFocusable?.focus();
		});

		return () => {
			window.cancelAnimationFrame(frame);
			previousFocusRef.current?.focus();
		};
	}, [open]);

	if (!open) return null;

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
			return;
		}

		if (event.key !== "Tab" || !panelRef.current) return;

		const focusable = Array.from(
			panelRef.current.querySelectorAll<HTMLElement>(
				'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
			),
		);

		if (focusable.length === 0) {
			event.preventDefault();
			panelRef.current.focus();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Clicking the backdrop is a conventional dialog dismissal affordance.
		<div
			className="ui-dialog-backdrop"
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				ref={panelRef}
				className={classes("ui-dialog", className)}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={description ? descriptionId : undefined}
				tabIndex={-1}
				onKeyDown={handleKeyDown}
			>
				<header className="ui-dialog__header">
					<div>
						<h2 className="ui-dialog__title" id={titleId}>
							{title}
						</h2>
						{description ? (
							<p className="ui-dialog__description" id={descriptionId}>
								{description}
							</p>
						) : null}
					</div>
					<IconButton aria-label="Close dialog" onClick={onClose}>
						×
					</IconButton>
				</header>
				<div className="ui-dialog__body">{children}</div>
				{actions ? (
					<footer className="ui-dialog__actions">{actions}</footer>
				) : null}
			</div>
		</div>
	);
}

export function BottomSheet(props: DialogProps) {
	return (
		<Dialog
			{...props}
			className={classes("ui-bottom-sheet", props.className)}
		/>
	);
}
