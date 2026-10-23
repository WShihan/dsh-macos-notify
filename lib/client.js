window.__ModuleLoader__.load({
	id: "dsh-macos-notify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		// src/settings.ts
		/**
		* Browser-safe data contract shared by the Host half and the settings page:
		* the settings namespace, the macOS alert-sound catalog, the editable banner
		* text, and the section the Host acts on. This module imports nothing and
		* touches no Node API, so the browser bundle inlines it.
		* @module dsh-macos-notify/settings
		*/
		/** Settings namespace the Host registers and the page edits. */
		const SETTINGS_NAMESPACE = "macos-notify";
		/** Every accepted banner sound, in the order the settings page offers them. */
		const SOUND_NAMES = [
			"none",
			"default",
			...[
				"Basso",
				"Blow",
				"Bottle",
				"Frog",
				"Funk",
				"Glass",
				"Hero",
				"Morse",
				"Ping",
				"Pop",
				"Purr",
				"Sosumi",
				"Submarine",
				"Tink"
			]
		];
		/**
		* Whether a configuration string names an accepted banner sound.
		* @param value - candidate value from configuration or a settings write.
		* @returns true when the value is one of {@link SOUND_NAMES}.
		*/
		function isSoundName(value) {
			return typeof value === "string" && SOUND_NAMES.includes(value);
		}
		/** The operations a banner reports; each carries its own sound and text. */
		const SOUND_KEYS = [
			"completed",
			"blocked",
			"aborted",
			"error",
			"maxTokens",
			"interrupted",
			"approval"
		];
		/** Sound every operation plays until the user picks another. */
		const DEFAULT_SOUNDS = Object.freeze({
			completed: "Glass",
			blocked: "Funk",
			aborted: "Basso",
			error: "Basso",
			maxTokens: "Funk",
			interrupted: "Basso",
			approval: "Ping"
		});
		/** Banner text every operation shows until the user writes another. */
		const DEFAULT_MESSAGES = Object.freeze({
			completed: Object.freeze({
				title: "Task completed",
				message: "The agent finished its turn."
			}),
			blocked: Object.freeze({
				title: "Task blocked",
				message: "The agent could not proceed."
			}),
			aborted: Object.freeze({
				title: "Task cancelled",
				message: "The agent was cancelled."
			}),
			error: Object.freeze({
				title: "Task failed",
				message: "{error}"
			}),
			maxTokens: Object.freeze({
				title: "Token limit reached",
				message: "The agent hit the output token ceiling."
			}),
			interrupted: Object.freeze({
				title: "Turn interrupted",
				message: "The turn was interrupted."
			}),
			approval: Object.freeze({
				title: "Permission requested",
				message: "{tool} needs {reason}"
			})
		});
		/**
		* Placeholders each operation's template may use. Every value is available
		* whenever that operation fires; a template may also use none of them.
		*/
		const PLACEHOLDERS = Object.freeze({
			completed: Object.freeze(["turn"]),
			blocked: Object.freeze(["turn"]),
			aborted: Object.freeze(["turn", "cause"]),
			error: Object.freeze(["turn", "error"]),
			maxTokens: Object.freeze(["turn"]),
			interrupted: Object.freeze(["turn"]),
			approval: Object.freeze(["tool", "reason"])
		});
		/** One `{name}` sequence, the whole placeholder grammar. */
		const PLACEHOLDER = /\{(\w+)\}/g;
		/**
		* Substitute `{name}` sequences from one operation's value table. A name with
		* no value stays verbatim, so a misspelled placeholder shows up in the banner
		* instead of erasing the sentence around it.
		* @param template - the configured or default template.
		* @param values - placeholder values for the operation that is firing.
		* @returns the template with every known placeholder replaced.
		*/
		function renderTemplate(template, values) {
			return template.replace(PLACEHOLDER, (match, name) => values[name] ?? match);
		}
		// src/client/locales.ts
		/** Locale namespace this page owns. */
		const LOCALE_NAMESPACE = "macos-notify";
		/** Locale key naming each operation's block. */
		const SOUND_LABEL_KEYS = Object.freeze({
			completed: "soundCompleted",
			blocked: "soundBlocked",
			aborted: "soundAborted",
			error: "soundError",
			maxTokens: "soundMaxTokens",
			interrupted: "soundInterrupted",
			approval: "soundApproval"
		});
		/** English copy. */
		const en = {
			nav: "Notifications",
			description: "System banners through osascript when the agent finishes or asks for permission. Text and sound are configurable per operation.",
			notifyOnTurnEnd: "Notify when a turn ends",
			notifyOnTurnEndHint: "One banner per turn that closes, whatever its reason.",
			notifyOnApproval: "Notify on permission requests",
			notifyOnApprovalHint: "One banner when an approval request reaches you.",
			topLevelOnly: "Only for my own sessions",
			topLevelOnlyHint: "Subagent sessions run silently in the background.",
			triggersSection: "When to notify",
			turnEndSection: "Turn-end banners",
			approvalSection: "Permission banner",
			soundCompleted: "Turn completed",
			soundBlocked: "Turn blocked",
			soundAborted: "Turn cancelled",
			soundError: "Turn failed",
			soundMaxTokens: "Token limit reached",
			soundInterrupted: "Turn interrupted",
			soundApproval: "Permission requested",
			soundNone: "Silent",
			soundDefault: "System default",
			messageTitle: "Title",
			messageBody: "Body",
			placeholders: "Placeholders",
			overridden: "Overridden",
			reset: "Reset to default",
			test: "Test",
			testing: "Sending…",
			save: "Save",
			discard: "Discard",
			unsaved: "Unsaved changes",
			sampleError: "Something went wrong.",
			sampleReason: "run a command",
			saving: "Saving…",
			failed: "The deployment did not accept this change.",
			readOnly: "This deployment stores settings read-only."
		};
		/** Simplified Chinese copy. */
		const zh = {
			nav: "通知",
			description: "agent 结束任务或请求权限时，通过 osascript 弹出系统横幅通知。每种操作的文本与提示音都可配置。",
			notifyOnTurnEnd: "轮次结束时通知",
			notifyOnTurnEndHint: "每个关闭的轮次弹出一条横幅，不论结束原因。",
			notifyOnApproval: "权限请求时通知",
			notifyOnApprovalHint: "审批请求需要你处理时弹出一条横幅。",
			topLevelOnly: "仅通知我自己的会话",
			topLevelOnlyHint: "子 agent 会话在后台静默运行，不弹通知。",
			triggersSection: "通知时机",
			turnEndSection: "轮次结束横幅",
			approvalSection: "权限请求横幅",
			soundCompleted: "轮次完成",
			soundBlocked: "轮次受阻",
			soundAborted: "轮次取消",
			soundError: "轮次失败",
			soundMaxTokens: "达到 token 上限",
			soundInterrupted: "轮次中断",
			soundApproval: "权限请求",
			soundNone: "静音",
			soundDefault: "系统默认",
			messageTitle: "标题",
			messageBody: "内容",
			placeholders: "可用变量",
			overridden: "已覆盖",
			reset: "恢复默认",
			test: "测试",
			testing: "发送中…",
			save: "保存",
			discard: "放弃",
			unsaved: "有未保存的修改",
			sampleError: "出了点问题。",
			sampleReason: "运行一条命令",
			saving: "保存中…",
			failed: "本部署没有接受这次修改。",
			readOnly: "本部署的设置为只读。"
		};
		// src/client/NotificationsSection.tsx
		/** Operations whose banner belongs to a turn ending; approval renders apart. */
		const TURN_END_KEYS = SOUND_KEYS.filter((key) => key !== "approval");
		const styles = {
			page: {
				display: "flex",
				flexDirection: "column",
				padding: "4px 2px 16px",
				maxWidth: 620
			},
			intro: {
				margin: "0 0 6px",
				fontSize: 12,
				lineHeight: 1.6,
				color: "var(--dsw-alias-label-secondary, inherit)"
			},
			groupTitle: {
				margin: "14px 0 2px",
				paddingTop: 10,
				fontSize: 12,
				fontWeight: 600,
				color: "var(--dsw-alias-label-secondary, inherit)",
				borderTop: "1px solid var(--dsw-alias-border-l1, #e5e7eb)"
			},
			row: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12,
				minHeight: 34
			},
			operation: {
				display: "flex",
				flexDirection: "column",
				gap: 6,
				padding: "10px 0"
			},
			operationHead: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12
			},
			field: {
				display: "flex",
				alignItems: "center",
				gap: 10
			},
			fieldLabel: {
				flex: "0 0 46px",
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary, inherit)"
			},
			input: {
				flex: "1 1 auto",
				minWidth: 0,
				padding: "4px 8px",
				fontSize: 13,
				borderRadius: 6,
				color: "var(--dsw-alias-label-primary, inherit)",
				background: "var(--dsw-alias-bg-overlay, transparent)",
				border: "1px solid var(--dsw-alias-border-l2, #d1d5db)"
			},
			label: {
				fontSize: 13,
				color: "var(--dsw-alias-label-primary, inherit)"
			},
			hint: {
				margin: "2px 0 0",
				fontSize: 11,
				color: "var(--dsw-alias-label-tertiary, inherit)"
			},
			controls: {
				display: "flex",
				alignItems: "center",
				gap: 6
			},
			select: {
				minWidth: 140,
				padding: "3px 6px",
				fontSize: 13,
				borderRadius: 6,
				color: "var(--dsw-alias-label-primary, inherit)",
				background: "var(--dsw-alias-bg-overlay, transparent)",
				border: "1px solid var(--dsw-alias-border-l2, #d1d5db)"
			},
			button: {
				padding: "3px 8px",
				fontSize: 12,
				cursor: "pointer",
				borderRadius: 6,
				color: "var(--dsw-alias-label-secondary, inherit)",
				background: "transparent",
				border: "1px solid var(--dsw-alias-border-l2, #d1d5db)"
			},
			primary: {
				padding: "4px 12px",
				fontSize: 12,
				cursor: "pointer",
				borderRadius: 6,
				color: "var(--dsw-alias-label-primary-inverted, #fff)",
				background: "var(--dsw-alias-brand-primary, #2563eb)",
				border: "1px solid var(--dsw-alias-brand-primary, #2563eb)"
			},
			badge: {
				marginLeft: 6,
				padding: "1px 5px",
				borderRadius: 4,
				fontSize: 10,
				color: "var(--dsw-alias-brand-primary, #2563eb)",
				border: "1px solid var(--dsw-alias-brand-primary, #2563eb)"
			},
			saveBar: {
				position: "sticky",
				bottom: 0,
				marginTop: 14,
				padding: "8px 10px",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12,
				borderRadius: 8,
				background: "var(--dsw-alias-bg-layer-1, transparent)",
				border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)"
			},
			notice: {
				margin: "10px 0 0",
				fontSize: 11,
				color: "var(--dsw-alias-state-error-primary, #dc2626)"
			},
			status: {
				margin: "8px 0 0",
				fontSize: 11,
				color: "var(--dsw-alias-label-tertiary, inherit)"
			}
		};
		/**
		* Render the Notifications settings page.
		* @param props - locale copy, the page snapshot, and its write actions.
		* @returns the page, or nothing until the Host serves the namespace.
		*/
		function NotificationsSection(props) {
			const { t } = props;
			const state = props.useNotifications((snapshot) => snapshot);
			if (!state.available) return null;
			const disabled = !state.writable;
			const soundLabel = (sound) => sound === "none" ? t("soundNone") : sound === "default" ? t("soundDefault") : sound;
			const textField = (key, name, field, label) => {
				const current = state.operations[key][field];
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					style: styles.field,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: styles.fieldLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "text",
						style: styles.input,
						"aria-label": `${name} ${label}`,
						value: current.draft,
						disabled,
						onChange: (event) => {
							props.editText(key, field, event.target.value);
						}
					})]
				});
			};
			const operationBlock = (key) => {
				const operation = state.operations[key];
				const name = t(SOUND_LABEL_KEYS[key]);
				const overridden = operation.soundOverridden || operation.title.overridden || operation.message.overridden;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: styles.operation,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: styles.operationHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: styles.label,
								children: [name, overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles.badge,
									children: t("overridden")
								}) : null]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: styles.controls,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										"aria-label": name,
										style: styles.select,
										value: operation.sound,
										disabled,
										onChange: (event) => {
											const next = event.target.value;
											if (isSoundName(next)) props.setSound(key, next);
										},
										children: SOUND_NAMES.map((sound) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: sound,
											children: soundLabel(sound)
										}, sound))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: styles.button,
										disabled: disabled || state.testing !== void 0,
										onClick: () => {
											props.test(key);
										},
										children: state.testing === key ? t("testing") : t("test")
									}),
									overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: styles.button,
										disabled,
										onClick: () => {
											props.resetOperation(key);
										},
										children: t("reset")
									}) : null
								]
							})]
						}),
						textField(key, name, "title", t("messageTitle")),
						textField(key, name, "message", t("messageBody")),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: styles.hint,
							children: [
								t("placeholders"),
								": ",
								PLACEHOLDERS[key].map((name) => `{${name}}`).join("  ")
							]
						})
					]
				}, key);
			};
			const toggleRow = (field, labelKey, hintKey, checked) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.row,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: styles.label,
					children: t(labelKey)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: styles.hint,
					children: t(hintKey)
				})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					"aria-label": t(labelKey),
					checked,
					disabled,
					onChange: (event) => {
						props.setToggle(field, event.target.checked);
					}
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.page,
				"aria-label": t("nav"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.intro,
						children: t("description")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: styles.groupTitle,
						children: t("triggersSection")
					}),
					toggleRow("notifyOnTurnEnd", "notifyOnTurnEnd", "notifyOnTurnEndHint", state.notifyOnTurnEnd),
					toggleRow("notifyOnApproval", "notifyOnApproval", "notifyOnApprovalHint", state.notifyOnApproval),
					toggleRow("topLevelOnly", "topLevelOnly", "topLevelOnlyHint", state.topLevelOnly),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: styles.groupTitle,
						children: t("turnEndSection")
					}),
					TURN_END_KEYS.map(operationBlock),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: styles.groupTitle,
						children: t("approvalSection")
					}),
					operationBlock("approval"),
					state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styles.saveBar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: styles.status,
							children: t("unsaved")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: styles.controls,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: styles.primary,
								disabled: disabled || state.saving,
								onClick: () => {
									props.save();
								},
								children: t("save")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: styles.button,
								disabled: state.saving,
								onClick: () => {
									props.discard();
								},
								children: t("discard")
							})]
						})]
					}) : null,
					state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.notice,
						children: t("failed")
					}) : null,
					disabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.status,
						children: t("readOnly")
					}) : null,
					state.saving ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.status,
						children: t("saving")
					}) : null
				]
			});
		}
		// src/client/snapshot-store.ts
		/**
		* Create one snapshot store.
		* @param init - the initial snapshot.
		* @returns the store.
		*/
		function createSnapshotStore(init) {
			let snapshot = init;
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => snapshot,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set: (next) => {
					snapshot = next;
					for (const listener of [...listeners]) listener();
				}
			};
		}
		// src/client/notifications-controller.ts
		/** The state rendered before the Host answers. */
		function initialState() {
			const operations = {};
			for (const key of SOUND_KEYS) {
				const text = {
					value: "",
					overridden: false,
					draft: ""
				};
				operations[key] = {
					sound: DEFAULT_SOUNDS[key],
					soundOverridden: false,
					title: {
						...text,
						value: DEFAULT_MESSAGES[key].title,
						draft: DEFAULT_MESSAGES[key].title
					},
					message: {
						...text,
						value: DEFAULT_MESSAGES[key].message,
						draft: DEFAULT_MESSAGES[key].message
					}
				};
			}
			return {
				available: false,
				writable: false,
				saving: false,
				failed: false,
				dirty: false,
				testing: void 0,
				notifyOnTurnEnd: true,
				notifyOnApproval: true,
				topLevelOnly: true,
				operations
			};
		}
		/** Read one nested object from a raw settings layer, or an empty record. */
		function asRecord(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		/** Stage key of one text field. */
		function stageId(key, field) {
			return `${key}.${field}`;
		}
		/** Whether two published states render identically. */
		function sameState(left, right) {
			if (left.available !== right.available || left.writable !== right.writable || left.saving !== right.saving || left.failed !== right.failed || left.dirty !== right.dirty || left.testing !== right.testing || left.notifyOnTurnEnd !== right.notifyOnTurnEnd || left.notifyOnApproval !== right.notifyOnApproval || left.topLevelOnly !== right.topLevelOnly) return false;
			return SOUND_KEYS.every((key) => {
				const a = left.operations[key];
				const b = right.operations[key];
				return a.sound === b.sound && a.soundOverridden === b.soundOverridden && sameText(a.title, b.title) && sameText(a.message, b.message);
			});
		}
		/** Whether two text fields render identically. */
		function sameText(left, right) {
			return left.value === right.value && left.overridden === right.overridden && left.draft === right.draft;
		}
		/** Bridges the `macos-notify` settings scope onto the page's snapshot. */
		var NotificationsController = class {
			scope;
			samples;
			store = createSnapshotStore(initialState());
			unsubscribe;
			/** Staged text by `${operation}.${field}`; an entry always differs from what is stored. */
			staged = /* @__PURE__ */ new Map();
			/**
			* Sounds written but not yet visible in the mirror. A preview taken right
			* after a pick, or while its write is still crossing, must play what the
			* page shows rather than the value it is replacing.
			*/
			pickedSounds = /* @__PURE__ */ new Map();
			pending = 0;
			failed = false;
			testing;
			/** Request id for the configuration's preview field; every click writes a new one. */
			nonce = Date.now();
			disposed = false;
			/**
			* @param scope - the shared configuration form of the `macos-notify` entry.
			* @param samples - placeholder samples a preview substitutes, read at click
			* time so a locale change reaches the next preview.
			*/
			constructor(scope, samples) {
				this.scope = scope;
				this.samples = samples;
				this.unsubscribe = scope.subscribe(() => {
					this.publish();
				});
				this.publish();
			}
			/** Stop following the scope; later settlements publish nothing. */
			dispose() {
				this.disposed = true;
				this.unsubscribe();
			}
			/**
			* Build the face the page's slot registration injects.
			* @returns the page's snapshot and its write actions.
			*/
			inject() {
				return {
					hooks: { notifications: this.store },
					setToggle: (field, value) => {
						this.run(() => this.scope.set(field, value));
					},
					setSound: (key, value) => {
						this.pickedSounds.set(key, value);
						this.run(() => this.scope.mutate([{
							op: "set",
							path: ["sounds", key],
							value
						}]), { onFailure: () => {
							this.pickedSounds.delete(key);
						} });
					},
					test: (key) => {
						this.test(key);
					},
					editText: (key, field, text) => {
						this.stage(key, field, text);
					},
					save: () => {
						this.save();
					},
					discard: () => {
						this.discard();
					},
					resetOperation: (key) => {
						this.resetOperation(key);
					}
				};
			}
			/** Project the scope snapshot onto what the page renders. */
			projection() {
				const snapshot = this.scope.getSnapshot();
				const section = snapshot.value;
				const user = asRecord(snapshot.user);
				const userSounds = asRecord(user.sounds);
				const userMessages = asRecord(user.messages);
				const operations = {};
				let dirty = false;
				const text = (key, field, stored, overridden) => {
					const draft = this.staged.get(stageId(key, field));
					if (draft === void 0 || draft === stored) return {
						value: stored,
						overridden,
						draft: stored
					};
					dirty = true;
					return {
						value: stored,
						overridden,
						draft
					};
				};
				for (const key of SOUND_KEYS) {
					const configured = section?.sounds?.[key];
					const configuredMessages = section?.messages?.[key];
					const userMessage = asRecord(userMessages[key]);
					const defaults = DEFAULT_MESSAGES[key];
					const soundOverridden = userSounds[key] !== void 0;
					const titleOverridden = userMessage.title !== void 0;
					const messageOverridden = userMessage.message !== void 0;
					const resolvedSound = isSoundName(configured) ? configured : DEFAULT_SOUNDS[key];
					const picked = this.pickedSounds.get(key);
					if (picked !== void 0 && picked === resolvedSound) this.pickedSounds.delete(key);
					operations[key] = {
						sound: picked ?? resolvedSound,
						soundOverridden,
						title: text(key, "title", configuredMessages?.title ?? defaults.title, titleOverridden),
						message: text(key, "message", configuredMessages?.message ?? defaults.message, messageOverridden)
					};
				}
				return {
					available: snapshot.status === "ready",
					writable: snapshot.writable,
					saving: this.pending > 0,
					failed: this.failed,
					dirty,
					testing: this.testing,
					notifyOnTurnEnd: section?.notifyOnTurnEnd ?? true,
					notifyOnApproval: section?.notifyOnApproval ?? true,
					topLevelOnly: section?.topLevelOnly ?? true,
					operations
				};
			}
			/** Stored text of one field in the current scope snapshot. */
			storedText(key, field) {
				return this.scope.getSnapshot().value?.messages?.[key]?.[field] ?? DEFAULT_MESSAGES[key][field];
			}
			stage(key, field, text) {
				const id = stageId(key, field);
				if (text === this.storedText(key, field)) this.staged.delete(id);
				else this.staged.set(id, text);
				this.publish();
			}
			test(key) {
				const operation = this.projection().operations[key];
				const values = this.samples()[key];
				const request = {
					op: key,
					nonce: ++this.nonce,
					sound: operation.sound,
					title: renderTemplate(operation.title.draft, values),
					message: renderTemplate(operation.message.draft, values)
				};
				this.testing = key;
				this.run(async () => {
					const accepted = await this.scope.set("preview", request);
					if (accepted) try {
						await this.scope.unset("preview");
					} catch {}
					return accepted;
				}, { onSettle: () => {
					this.testing = void 0;
				} });
			}
			save() {
				if (this.staged.size === 0) return;
				const written = [...this.staged];
				const ops = written.map(([id, value]) => {
					const [key, field] = id.split(".");
					return {
						op: "set",
						path: [
							"messages",
							key,
							field
						],
						value
					};
				});
				this.run(() => this.scope.mutate(ops), { onSuccess: () => {
					for (const [id, value] of written) if (this.staged.get(id) === value) this.staged.delete(id);
				} });
			}
			discard() {
				if (this.staged.size === 0) return;
				this.staged.clear();
				this.publish();
			}
			resetOperation(key) {
				this.run(() => this.scope.mutate([
					{
						op: "unset",
						path: ["sounds", key]
					},
					{
						op: "unset",
						path: [
							"messages",
							key,
							"title"
						]
					},
					{
						op: "unset",
						path: [
							"messages",
							key,
							"message"
						]
					}
				]), { onSuccess: () => {
					this.staged.delete(stageId(key, "title"));
					this.staged.delete(stageId(key, "message"));
				} });
			}
			publish() {
				if (this.disposed) return;
				const next = this.projection();
				if (sameState(this.store.getSnapshot(), next)) return;
				this.store.set(next);
			}
			/**
			* Run one settings write, publishing the in-flight and settled states. A
			* refusal is reported on the page; the configuration mirror is what
			* corrects the rendered values afterwards.
			* @param write - the queued configuration write.
			* @param hooks - staged state to settle once the write lands, optimistic
			* state to drop when it does not, and in-flight state to clear either way.
			*/
			run(write, hooks = {}) {
				this.failed = false;
				this.pending += 1;
				this.publish();
				write().then((accepted) => {
					if (!accepted) {
						this.failed = true;
						hooks.onFailure?.();
					} else hooks.onSuccess?.();
					hooks.onSettle?.();
					this.settle();
				}, () => {
					this.failed = true;
					hooks.onFailure?.();
					hooks.onSettle?.();
					this.settle();
				});
			}
			settle() {
				this.pending -= 1;
				this.publish();
			}
		};
		// src/client/index.ts
		/** Section key the settings navigation lists and `openSection` addresses. */
		const SECTION_ID = "notifications";
		/**
		* Navigation position. General is 0, Models 10, Plugins 15, and Agent presets
		* 20 (the shipped sections), so a deployment-owned preference page lands after
		* them.
		*/
		const SECTION_ORDER = 25;
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"locale",
			"configForms"
		];
		/**
		* Register the page's dictionary and its `settings.section` contribution.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const t = ctx.locale.bind(LOCALE_NAMESPACE);
			ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, {
				en,
				zh
			}), "macos-notify: page dictionaries");
			const samples = () => ({
				completed: { turn: "1" },
				blocked: { turn: "1" },
				aborted: {
					turn: "1",
					cause: "user"
				},
				error: {
					turn: "1",
					error: t("sampleError")
				},
				maxTokens: { turn: "1" },
				interrupted: { turn: "1" },
				approval: {
					tool: "shell",
					reason: t("sampleReason")
				}
			});
			const controller = new NotificationsController(ctx.configForms.get(SETTINGS_NAMESPACE), samples);
			ctx.effect(() => () => {
				controller.dispose();
			}, "macos-notify: page snapshot");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: SECTION_ID,
				order: 25,
				label: () => t("nav"),
				locale: LOCALE_NAMESPACE,
				inject: () => controller.inject()
			}, NotificationsSection));
		}
		exports.SECTION_ID = SECTION_ID;
		exports.SECTION_ORDER = SECTION_ORDER;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map