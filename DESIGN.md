# Design

## Summary

DengueWatch now uses a single civic atlas system. The UI favors pale map-blue surfaces, deep teal actions, strong contrast, compact rounded geometry, and a responsive shell that shifts from a mobile top-bar plus bottom-nav model to a desktop left-rail app layout. The intent is an operational public-health interface, not a marketing site or a decorative dashboard.

Assessed scope note: the core design system in this file covers resident and public flows. The prototype officer console remains in the repository, but it is out of scope for architecture and evaluation claims. The deployed public edge currently uses Amazon CloudFront (`d2yol17g6mes38.cloudfront.net`), with edge configuration managed outside this repository.

## Colors

- `--color-accent`: `#00464f`
- `--color-surface`: `#f3faff`
- `--color-surface-muted`: `#e6f6ff`
- `--color-surface-rail`: `#dff0fb`
- `--color-ink`: `#021f29`
- `--color-ink-soft`: `#42585f`
- `--color-warning`: `#ba1a1a`
- `--color-success`: `#156874`

## Typography

- Headings: `Work Sans`
- Body: `Work Sans`
- Labels and compact UI text: `Inter`
- Tone: restrained product typography, high legibility, no decorative display treatment

## Layout

- Mobile: fixed top bar and five-item bottom nav for resident routes
- Desktop: fixed left navigation rail with public routes
- Page canvas: centered content area with surface-based sections, map-first layouts, and dense operational panels where appropriate
- Spacing: 8px rhythm, with 8/12/16px radii depending on component density

## Components

- Primary CTA buttons use deep teal fill with white text
- Secondary and ghost buttons use pale blue or transparent surfaces
- Panels and surfaces use light borders, pale surfaces, and restrained shadows
- Status badges use tinted semantic backgrounds rather than heavy borders
- Report wizard, public map, public detail, and status tracking all inherit the same shell and action vocabulary
- Shared UI vocabulary: page headers, surfaces, metric tiles, info strips, steppers, status pills, and filter chips

## Route Intent

- `/`: resident home and entry point
- `/report`: stateful resident submission flow
- `/map`: public awareness map
- `/status`: anonymous report tracking
- `/learn`: habitat-identification guidance
- `/officer`: experimental operational review console retained in the repo, but out of scope for the assessed implementation
- `/map/reports/:reference`: public evidence detail page
