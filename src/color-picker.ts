/**
 * Reusable color picker component for Obsidian plugins.
 *
 * Supports: #RRGGBB, #RRGGBBAA, rgb(r,g,b), rgba(r,g,b,a)
 * Provides: visual swatch preview, native color picker, text input, opacity slider.
 *
 * This module is self-contained and can be copied to other plugins.
 */

import { parseColor, rgbaToHex, isHexColor } from "./utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColorPickerOptions {
	/** Parent element to render into. */
	container: HTMLElement;
	/** Label text shown above the picker. */
	label: string;
	/** Current color value (hex, rgb, rgba, or empty string). */
	value: string;
	/** Called when the user changes the color. */
	onChange: (value: string) => void;
	/** Placeholder text for the text input. */
	placeholder?: string;
	/** Optional CSS class prefix (default: "ts"). */
	cssPrefix?: string;
}

export interface ColorPickerControls {
	/** Update the picker's displayed value externally. */
	setValue: (value: string) => void;
	/** Get the current value. */
	getValue: () => string;
	/** The root container element. */
	el: HTMLElement;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Render a color picker into the given container.
 *
 * Layout:
 *   [Label]
 *   [Swatch] [Native Picker (hidden)] [Text Input] [Clear]
 *   [Opacity slider] [Opacity value]
 *
 * The swatch shows the current color and opens the native picker on click.
 * The text input accepts any supported format and validates on change.
 * The opacity slider adjusts alpha from 0% to 100%.
 */
export function renderColorPicker(options: ColorPickerOptions): ColorPickerControls {
	const {
		container,
		label,
		value,
		onChange,
		placeholder,
		cssPrefix = "ts",
	} = options;

	let currentR = 0;
	let currentG = 0;
	let currentB = 0;
	let currentA = 1;
	let isEmpty = true;

	// Parse initial value
	const initialParsed = parseColor(value);
	if (initialParsed) {
		currentR = initialParsed.r;
		currentG = initialParsed.g;
		currentB = initialParsed.b;
		currentA = initialParsed.a;
		isEmpty = false;
	}

	const section = container.createDiv(`${cssPrefix}-color-picker`);
	section.createEl("label", { text: label, cls: `${cssPrefix}-color-picker-label` });

	// --- Row 1: Swatch + text input + clear ---
	const row = section.createDiv(`${cssPrefix}-color-picker-row`);

	// Swatch + native input wrapper
	const swatchWrapper = row.createDiv(`${cssPrefix}-color-swatch-wrapper`);

	const nativeInput = swatchWrapper.createEl("input", {
		type: "color",
		cls: `${cssPrefix}-color-native-input`,
	});
	const inputId = `ts-color-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	nativeInput.id = inputId;
	nativeInput.value = isEmpty ? "#6c757d" : rgbaToHex(currentR, currentG, currentB);

	const swatch = swatchWrapper.createEl("label", {
		cls: `${cssPrefix}-color-swatch`,
		attr: {
			"for": inputId,
			"role": "button",
			"tabindex": "0",
			"aria-label": `Pick ${label.toLowerCase()}`,
		},
	});
	applySwatch(swatch, isEmpty ? "" : formatOutput(currentR, currentG, currentB, currentA), cssPrefix);

	// Text input
	const textInput = row.createEl("input", {
		type: "text",
		cls: `${cssPrefix}-color-text-input`,
		placeholder: placeholder ?? "#RRGGBB, #RRGGBBAA, rgb(), rgba()",
		value: value || "",
	});

	// Clear button
	const clearBtn = row.createEl("button", {
		cls: `${cssPrefix}-color-clear-btn`,
		attr: { type: "button", "aria-label": "Clear color" },
	});
	clearBtn.setText("\u2715");

	// --- Row 2: Opacity slider ---
	const opacityRow = section.createDiv(`${cssPrefix}-color-opacity-row`);
	opacityRow.createEl("label", {
		text: "Opacity",
		cls: `${cssPrefix}-color-opacity-label`,
	});

	const opacitySlider = opacityRow.createEl("input", {
		type: "range",
		cls: `${cssPrefix}-color-opacity-slider`,
		attr: { min: "0", max: "100", step: "1" },
	});
	opacitySlider.value = String(Math.round(currentA * 100));
	updateSliderTrack(opacitySlider, currentA);

	const opacityValue = opacityRow.createEl("span", {
		text: `${Math.round(currentA * 100)}%`,
		cls: `${cssPrefix}-color-opacity-value`,
	});

	// --- Shared update logic ---

	function emitChange(): void {
		const output = isEmpty ? "" : formatOutput(currentR, currentG, currentB, currentA);
		textInput.value = output;
		applySwatch(swatch, output, cssPrefix);
		if (!isEmpty) {
			nativeInput.value = rgbaToHex(currentR, currentG, currentB);
		}
		opacitySlider.value = String(Math.round(currentA * 100));
		opacityValue.textContent = `${Math.round(currentA * 100)}%`;
		updateSliderTrack(opacitySlider, currentA);
		onChange(output);
	}

	// --- Event handlers ---

	nativeInput.addEventListener("input", () => {
		const p = parseColor(nativeInput.value);
		if (p) {
			currentR = p.r;
			currentG = p.g;
			currentB = p.b;
			// Keep current alpha
			isEmpty = false;
			emitChange();
		}
	});

	textInput.addEventListener("input", () => {
		const val = textInput.value.trim();
		const p = parseColor(val);
		if (p) {
			currentR = p.r;
			currentG = p.g;
			currentB = p.b;
			currentA = p.a;
			isEmpty = false;
			applySwatch(swatch, val, cssPrefix);
			if (isHexColor(val)) {
				nativeInput.value = val;
			}
			opacitySlider.value = String(Math.round(currentA * 100));
			opacityValue.textContent = `${Math.round(currentA * 100)}%`;
			updateSliderTrack(opacitySlider, currentA);
		} else if (val === "") {
			applySwatch(swatch, "", cssPrefix);
		}
	});

	textInput.addEventListener("change", () => {
		const val = textInput.value.trim();
		const p = parseColor(val);
		if (p) {
			currentR = p.r;
			currentG = p.g;
			currentB = p.b;
			currentA = p.a;
			isEmpty = false;
		} else if (val === "") {
			isEmpty = true;
			currentA = 1;
		}
		emitChange();
	});

	opacitySlider.addEventListener("input", () => {
		currentA = parseInt(opacitySlider.value, 10) / 100;
		opacityValue.textContent = `${Math.round(currentA * 100)}%`;
		updateSliderTrack(opacitySlider, currentA);
		if (!isEmpty) {
			const output = formatOutput(currentR, currentG, currentB, currentA);
			textInput.value = output;
			applySwatch(swatch, output, cssPrefix);
		}
	});

	opacitySlider.addEventListener("change", () => {
		currentA = parseInt(opacitySlider.value, 10) / 100;
		if (!isEmpty) {
			emitChange();
		}
	});

	clearBtn.addEventListener("click", () => {
		isEmpty = true;
		currentA = 1;
		textInput.value = "";
		nativeInput.value = "#6c757d";
		opacitySlider.value = "100";
		opacityValue.textContent = "100%";
		updateSliderTrack(opacitySlider, 1);
		applySwatch(swatch, "", cssPrefix);
		onChange("");
	});

	return {
		setValue(val: string) {
			const p = parseColor(val);
			if (p) {
				currentR = p.r;
				currentG = p.g;
				currentB = p.b;
				currentA = p.a;
				isEmpty = false;
			} else {
				isEmpty = true;
				currentA = 1;
			}
			textInput.value = val;
			applySwatch(swatch, val, cssPrefix);
			if (p) nativeInput.value = rgbaToHex(p.r, p.g, p.b);
			opacitySlider.value = String(Math.round(currentA * 100));
			opacityValue.textContent = `${Math.round(currentA * 100)}%`;
			updateSliderTrack(opacitySlider, currentA);
		},
		getValue() {
			return isEmpty ? "" : formatOutput(currentR, currentG, currentB, currentA);
		},
		el: section,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applySwatch(el: HTMLElement, value: string, cssPrefix: string): void {
	const trimmed = (value || "").trim();
	if (!trimmed) {
		el.setCssStyles({ backgroundColor: "transparent" });
		el.classList.add(`${cssPrefix}-color-swatch-empty`);
		return;
	}
	el.classList.remove(`${cssPrefix}-color-swatch-empty`);
	el.setCssStyles({ backgroundColor: trimmed });
}

/**
 * Format the current RGBA values as a color string.
 * Uses #RRGGBB when fully opaque, #RRGGBBAA otherwise.
 */
function formatOutput(r: number, g: number, b: number, a: number): string {
	if (a >= 1) {
		return rgbaToHex(r, g, b);
	}
	return rgbaToHex(r, g, b, a);
}

/**
 * Update the slider track fill to visually indicate the current value.
 */
function updateSliderTrack(slider: HTMLInputElement, alpha: number): void {
	const pct = Math.round(alpha * 100);
	slider.style.setProperty("--slider-progress", `${pct}%`);
}
