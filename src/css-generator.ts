/**
 * Generate CSS rules for a single tag style.
 *
 * Targets reading view (a.tag, .tag), live preview (.cm-editor a.tag),
 * and CodeMirror editor (.cm-editor span.cm-tag-*, .cm-editor span.cm-hashtag.cm-tag-*).
 */

import type { TagStyle } from "./main";
import {
	normalizeTagName,
	normalizeTagClass,
	normalizeFontSize,
	escapeAttributeValue,
	sanitizeCssValue,
} from "./utils";

export function generateTagCSS(style: TagStyle): string {
	const tag = normalizeTagName(style?.tag);
	if (!tag) return "";

	const tagWithHash = `#${tag}`;
	const tagClassStrip = normalizeTagClass(tag);
	const tagClassDash = tag
		.replace(/\//g, "-")
		.replace(/[^A-Za-z0-9_-]/g, "-");

	const rules: string[] = [];
	if (style.textColor) {
		rules.push(`  color: ${sanitizeCssValue(style.textColor)} !important;`);
	}
	if (style.backgroundColor) {
		rules.push(`  background-color: ${sanitizeCssValue(style.backgroundColor)} !important;`);
	} else {
		rules.push("  background-color: transparent !important;");
		rules.push("  background-image: none !important;");
	}
	if (style.fontSize) {
		const fontSize = normalizeFontSize(style.fontSize);
		if (fontSize) {
			rules.push(`  font-size: ${fontSize} !important;`);
		}
	}
	if (rules.length === 0) return "";

	const escapedTag = escapeAttributeValue(tag);
	const escapedTagWithHash = escapeAttributeValue(tagWithHash);
	const selectors = [
		`a.tag[href="#${escapedTag}"]`,
		`.tag[href="#${escapedTag}"]`,
		`a.tag[data-tag="${escapedTag}"]`,
		`.tag[data-tag="${escapedTag}"]`,
		`a.tag[href="${escapedTagWithHash}"]`,
		`.tag[href="${escapedTagWithHash}"]`,
		`a.tag[data-tag="${escapedTagWithHash}"]`,
		`.tag[data-tag="${escapedTagWithHash}"]`,
		`.cm-editor a.tag[href="#${escapedTag}"]`,
		`.cm-editor a.tag[href="${escapedTagWithHash}"]`,
		`.cm-editor a.tag[data-tag="${escapedTag}"]`,
		`.cm-editor a.tag[data-tag="${escapedTagWithHash}"]`,
	];

	if (tagClassStrip) {
		selectors.push(`.cm-editor span.cm-tag-${tagClassStrip}`);
		selectors.push(`.cm-editor span.cm-hashtag.cm-tag-${tagClassStrip}`);
	}

	if (tagClassDash && tagClassDash !== tagClassStrip) {
		selectors.push(`.cm-editor span.cm-tag-${tagClassDash}`);
		selectors.push(`.cm-editor span.cm-hashtag.cm-tag-${tagClassDash}`);
	}

	return `
/* Tag: #${tag} */
${selectors.join(",\n")} {
${rules.join("\n")}
}`;
}

/**
 * Generate combined CSS for all tag styles.
 */
export function generateAllTagCSS(styles: TagStyle[]): string {
	if (!styles || styles.length === 0) return "";
	return styles.map(generateTagCSS).filter(Boolean).join("\n");
}
