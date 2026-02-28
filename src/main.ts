import {
	Plugin,
	PluginSettingTab,
	type App,
	type CachedMetadata,
	type MetadataCache,
	type TagCache,
} from "obsidian";
import { renderColorPicker } from "./color-picker";
import { generateAllTagCSS } from "./css-generator";
import { normalizeTagName, normalizeFontSize } from "./utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagStyle {
	tag: string;
	textColor: string;
	backgroundColor: string;
	fontSize: string;
}

export interface TagStylerSettings {
	tagStyles: TagStyle[];
}

const DEFAULT_SETTINGS: TagStylerSettings = {
	tagStyles: [],
};

type MetadataCacheWithTags = MetadataCache & {
	getTags?: () => Record<string, number>;
};

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default class TagStylerPlugin extends Plugin {
	settings: TagStylerSettings = DEFAULT_SETTINGS;
	private styleSheet: CSSStyleSheet | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.styleSheet = new CSSStyleSheet();
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.styleSheet];
		this.updateCSS();

		this.addSettingTab(new TagStylerSettingTab(this.app, this));
	}

	onunload(): void {
		if (this.styleSheet) {
			document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== this.styleSheet);
			this.styleSheet = null;
		}
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<TagStylerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
		if (!Array.isArray(this.settings.tagStyles)) {
			this.settings.tagStyles = [];
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	updateCSS(): void {
		if (!this.styleSheet) return;
		this.styleSheet.replaceSync(generateAllTagCSS(this.settings.tagStyles));
	}
}

// ---------------------------------------------------------------------------
// Vault tag discovery
// ---------------------------------------------------------------------------

function getAllVaultTagCounts(app: App): Map<string, number> {
	const tagCounts = new Map<string, number>();
	const metadataCache: MetadataCacheWithTags = app.metadataCache;
	const tagMap = metadataCache.getTags ? metadataCache.getTags() : {};

	const tagEntries = Object.entries(tagMap);
	tagEntries.forEach(([tag, count]) => {
		const normalized = normalizeTagName(tag);
		if (!normalized) return;
		tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + count);
	});

	if (tagEntries.length > 0) {
		return tagCounts;
	}

	// Fallback: iterate files manually
	const files = app.vault.getMarkdownFiles();
	files.forEach((file) => {
		const cache: CachedMetadata | null = metadataCache.getFileCache(file);
		if (!cache) return;

		const collectTag = (tagValue?: string | null) => {
			const normalized = normalizeTagName(tagValue);
			if (!normalized) return;
			tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
		};

		const fileTags = cache.tags || [];
		fileTags.forEach((tag: TagCache) => collectTag(tag.tag));

		const frontmatterTags: unknown = cache.frontmatter?.tags;
		if (Array.isArray(frontmatterTags)) {
			frontmatterTags.forEach((tag: unknown) => collectTag(typeof tag === "string" ? tag : String(tag)));
		} else if (typeof frontmatterTags === "string") {
			frontmatterTags
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean)
				.forEach((tag) => collectTag(tag));
		}
	});

	return tagCounts;
}

async function getAllVaultTagCountsDeep(
	app: App,
): Promise<{ tagNames: string[]; tagCounts: Map<string, number> }> {
	const tagCounts = getAllVaultTagCounts(app);
	const tagNames = Array.from(tagCounts.keys()).sort((a, b) =>
		a.localeCompare(b),
	);
	return { tagNames, tagCounts };
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

class TagStylerSettingTab extends PluginSettingTab {
	plugin: TagStylerPlugin;
	private lastRenderId = 0;

	constructor(app: App, plugin: TagStylerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("p", {
			text: "Customize the appearance of tags in your vault. Set text color, background color (with opacity), and font size for each tag.",
			cls: "ts-hint",
		});

		const tagList = containerEl.createDiv("ts-tag-list");
		tagList.createEl("div", { text: "Loading tags...", cls: "ts-muted" });

		const renderId = Date.now();
		this.lastRenderId = renderId;

		const renderTagList = async (
			tagNames: string[],
			tagCounts: Map<string, number>,
		) => {
			if (this.lastRenderId !== renderId) return;
			tagList.empty();

			const tagStyles = this.plugin.settings.tagStyles;

			// Merge vault tags with styled tags
			const normalizedTagSet = new Set<string>(tagNames);
			tagStyles
				.map((style) => normalizeTagName(style.tag))
				.filter(Boolean)
				.forEach((tag) => normalizedTagSet.add(tag));

			const mergedTagNames = Array.from(normalizedTagSet).sort((a, b) =>
				a.localeCompare(b),
			);

			if (!mergedTagNames.length) {
				tagList.createEl("div", {
					text: "No tags found in this vault.",
					cls: "ts-empty-message",
				});
				return;
			}

			const getTagStyle = (tagName: string) =>
				tagStyles.find((style) => normalizeTagName(style.tag) === tagName);

			const ensureTagStyle = (tagName: string): TagStyle => {
				let style = getTagStyle(tagName);
				if (!style) {
					style = {
						tag: tagName,
						textColor: "",
						backgroundColor: "",
						fontSize: "",
					};
					tagStyles.push(style);
				}
				return style;
			};

			const maybeRemoveEmptyTagStyle = (tagName: string) => {
				const style = getTagStyle(tagName);
				if (!style) return;
				if (style.textColor || style.backgroundColor || style.fontSize) return;
				const index = tagStyles.indexOf(style);
				if (index !== -1) {
					tagStyles.splice(index, 1);
				}
			};

			const saveTagStyles = async () => {
				await this.plugin.saveSettings();
				this.plugin.updateCSS();
			};

			mergedTagNames.forEach((tagName) => {
				const style = getTagStyle(tagName) || {
					tag: tagName,
					textColor: "",
					backgroundColor: "",
					fontSize: "",
				};
				const usageCount = tagCounts.get(tagName) ?? 0;

				const item = tagList.createDiv("ts-tag-item");
				const header = item.createDiv("ts-tag-header");
				const preview = header.createDiv("ts-tag-preview");
				preview.textContent = `#${tagName}`;
				preview.setCssStyles({ color: style.textColor || "" });
				preview.setCssStyles({ backgroundColor: style.backgroundColor || "" });
				preview.setCssStyles({
					fontSize: style.fontSize
						? normalizeFontSize(style.fontSize)
						: "",
				});

				const actions = header.createDiv("ts-tag-actions");
				actions.createEl("span", {
					text: `${usageCount} use${usageCount === 1 ? "" : "s"}`,
					cls: "ts-tag-usage",
				});

				const editButton = actions.createEl("button", { text: "Edit" });
				const controls = item.createDiv("ts-tag-controls");
				controls.addClass("ts-tag-controls-hidden");

				editButton.addEventListener("click", () => {
					const isHidden = controls.hasClass("ts-tag-controls-hidden");
					controls.toggleClass("ts-tag-controls-hidden", !isHidden);
					editButton.textContent = isHidden ? "Hide" : "Edit";
				});

				if (usageCount === 0 && getTagStyle(tagName)) {
					const removeButton = actions.createEl("button", {
						text: "Remove",
						cls: "ts-remove-btn",
					});
					removeButton.addEventListener("click", () => {
						const target = getTagStyle(tagName);
						if (!target) return;
						const index = tagStyles.indexOf(target);
						if (index !== -1) {
							tagStyles.splice(index, 1);
						}
						void saveTagStyles().then(() => {
							void renderTagList(mergedTagNames, tagCounts);
						});
					});
				}

				// Text color picker
				renderColorPicker({
					container: controls,
					label: "Text color",
					value: style.textColor,
					onChange: (value) => {
						const target = ensureTagStyle(tagName);
						target.textColor = value;
						preview.setCssStyles({ color: value || "" });
						maybeRemoveEmptyTagStyle(tagName);
						void saveTagStyles();
					},
				});

				// Background color picker
				renderColorPicker({
					container: controls,
					label: "Background color",
					value: style.backgroundColor,
					onChange: (value) => {
						const target = ensureTagStyle(tagName);
						target.backgroundColor = value;
						preview.setCssStyles({ backgroundColor: value || "" });
						maybeRemoveEmptyTagStyle(tagName);
						void saveTagStyles();
					},
				});

				// Font size input
				const fontSizeControl = controls.createDiv("ts-tag-control");
				fontSizeControl.createEl("label", { text: "Font size" });
				const fontSizeInputWrapper = fontSizeControl.createDiv("ts-tag-input-wrapper");
				const sizeInput = fontSizeInputWrapper.createEl("input", {
					type: "text",
					value: style.fontSize || "",
					placeholder: "e.g. 14px, 1.2em",
					cls: "ts-tag-size-input",
				});
				sizeInput.addEventListener("change", () => {
					const target = ensureTagStyle(tagName);
					target.fontSize = sizeInput.value.trim();
					preview.setCssStyles({
						fontSize: target.fontSize
							? normalizeFontSize(target.fontSize)
							: "",
					});
					maybeRemoveEmptyTagStyle(tagName);
					void saveTagStyles();
				});
			});
		};

		void getAllVaultTagCountsDeep(this.app).then(({ tagNames, tagCounts }) => {
			void renderTagList(tagNames, tagCounts);
			if (tagNames.length <= 1) {
				window.setTimeout(() => {
					void getAllVaultTagCountsDeep(this.app).then((retryResult) => {
						void renderTagList(retryResult.tagNames, retryResult.tagCounts);
					});
				}, 1200);
			}
		});
	}
}
