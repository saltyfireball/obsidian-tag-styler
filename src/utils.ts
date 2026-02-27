/**
 * Utility functions for tag styling and color parsing.
 */

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

/**
 * Parse a color string into an RGBA object.
 * Supports: #RRGGBB, #RRGGBBAA, rgb(r,g,b), rgba(r,g,b,a).
 * Returns null if the input cannot be parsed.
 */
export function parseColor(
	value?: string,
): { r: number; g: number; b: number; a: number } | null {
	const trimmed = (value || "").trim();
	if (!trimmed) return null;

	// Try rgb/rgba
	const rgbaMatch = trimmed.match(
		/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
	);
	if (rgbaMatch) {
		const r = Math.min(255, Math.max(0, Math.round(parseFloat(rgbaMatch[1]))));
		const g = Math.min(255, Math.max(0, Math.round(parseFloat(rgbaMatch[2]))));
		const b = Math.min(255, Math.max(0, Math.round(parseFloat(rgbaMatch[3]))));
		const a = rgbaMatch[4] !== undefined
			? Math.min(1, Math.max(0, parseFloat(rgbaMatch[4])))
			: 1;
		if ([r, g, b, a].some((val) => Number.isNaN(val))) return null;
		return { r, g, b, a };
	}

	// Try hex
	const hex = trimmed.replace(/^#/, "");
	if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return null;
	const r = parseInt(hex.slice(0, 2), 16);
	const g = parseInt(hex.slice(2, 4), 16);
	const b = parseInt(hex.slice(4, 6), 16);
	const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
	return { r, g, b, a };
}

/**
 * Convert RGBA values to a hex string (#RRGGBB or #RRGGBBAA).
 */
export function rgbaToHex(r: number, g: number, b: number, a?: number): string {
	const hex = "#" +
		r.toString(16).padStart(2, "0") +
		g.toString(16).padStart(2, "0") +
		b.toString(16).padStart(2, "0");
	if (a !== undefined && a < 1) {
		return hex + Math.round(a * 255).toString(16).padStart(2, "0");
	}
	return hex;
}

/**
 * Validate a 6-digit hex color string (e.g. "#ff6188").
 */
export function isHexColor(value?: string): boolean {
	return /^#[0-9A-Fa-f]{6}$/.test((value || "").trim());
}

// ---------------------------------------------------------------------------
// Tag utilities
// ---------------------------------------------------------------------------

/**
 * Normalize a tag name by stripping leading # characters.
 */
export function normalizeTagName(value?: string | null): string {
	return (value || "").trim().replace(/^#+/, "");
}

/**
 * Normalize a tag name to a safe CSS class fragment.
 * Removes slashes and replaces non-alphanumeric characters with hyphens.
 */
export function normalizeTagClass(value?: string | null): string {
	const normalized = normalizeTagName(value);
	if (!normalized) return "";
	const withoutSlashes = normalized.replace(/\//g, "");
	return withoutSlashes.replace(/[^A-Za-z0-9_-]/g, "-");
}

/**
 * Normalize a font size value -- appends "px" if the value is digits only.
 */
export function normalizeFontSize(value?: string | null): string {
	const trimmed = (value || "").trim();
	if (!trimmed) return "";
	return /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
}

/**
 * Escape a value for use in CSS attribute selectors.
 */
export function escapeAttributeValue(value?: string | null): string {
	return (value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Sanitize a CSS value to prevent injection via semicolons, braces, etc.
 */
export function sanitizeCssValue(value?: string | null): string {
	if (!value) return "";
	return value.replace(/[{}<>;@\\]/g, "").trim();
}
