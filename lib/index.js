//#region ../vendor/cosmokit/src/misc.ts
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
//#endregion
//#region ../vendor/cosmokit/src/types.ts
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value) => is(type, value);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
let Binary;
(function(_Binary) {
	_Binary.is = isArrayBufferLike;
	_Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	_Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	_Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	_Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	_Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	_Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
Binary.fromBase64;
Binary.toBase64;
Binary.fromHex;
Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result = [];
		refs.set(source, result);
		source.forEach((value, index) => {
			result[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
function deepEqual(a, b, strict) {
	if (a === b) return true;
	if (!strict && isNullable(a) && isNullable(b)) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (!a || !b) return false;
	function check(test, then) {
		return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
	}
	return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
		if (a.byteLength !== b.byteLength) return false;
		const viewA = new Uint8Array(a);
		const viewB = new Uint8Array(b);
		for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
		return true;
	}) ?? Object.keys({
		...a,
		...b
	}).every((key) => deepEqual(a[key], b[key], strict));
}
//#endregion
//#region ../vendor/cosmokit/src/time.ts
let Time;
(function(_Time) {
	_Time.millisecond = 1;
	const second = _Time.second = 1e3;
	const minute = _Time.minute = second * 60;
	const hour = _Time.hour = minute * 60;
	const day = _Time.day = hour * 24;
	const week = _Time.week = day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	_Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	_Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / minute - offset) / 1440);
	}
	_Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * minute);
	}
	_Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * week || 0) + (parseFloat(capture[2]) * day || 0) + (parseFloat(capture[3]) * hour || 0) + (parseFloat(capture[4]) * minute || 0) + (parseFloat(capture[5]) * second || 0);
	}
	_Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	_Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= day - hour / 2) return Math.round(ms / day) + "d";
		else if (abs >= hour - minute / 2) return Math.round(ms / hour) + "h";
		else if (abs >= minute - second / 2) return Math.round(ms / minute) + "m";
		else if (abs >= second) return Math.round(ms / second) + "s";
		return ms + "ms";
	}
	_Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	_Time.toDigits = toDigits;
	function template(template, time = /* @__PURE__ */ new Date()) {
		return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	_Time.template = template;
})(Time || (Time = {}));
//#endregion
//#region ../vendor/schemastery/src/index.ts
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options = {}) {
		return Schema.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
const resolvers = {};
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
//#endregion
//#region src/settings.ts
/**
* Browser-safe data contract shared by the Host half and the settings page:
* the settings namespace, the macOS alert-sound catalog, the editable banner
* text, and the section the Host acts on. This module imports nothing and
* touches no Node API, so the browser bundle inlines it.
* @module dsh-macos-notify/settings
*/
/** Settings namespace the Host registers and the page edits. */
const SETTINGS_NAMESPACE = "macos-notify";
/**
* Settings namespace carrying one banner preview request. The page writes it,
* the Host fires the banner and clears it again. A plugin's browser half
* reaches the Host only through the generated remote namespaces, and this
* package ships outside that assembly, so the settings document is the one
* channel both halves already share.
*/
const PREVIEW_NAMESPACE = "macos-notify-preview";
/**
* Alert sounds every macOS release ships in `/System/Library/Sounds`. The
* names are Apple's, passed verbatim to AppleScript `sound name`.
*/
const SYSTEM_SOUNDS = [
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
];
/** Every accepted banner sound, in the order the settings page offers them. */
const SOUND_NAMES = [
	"none",
	"default",
	...SYSTEM_SOUNDS
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
/**
* Whether a configuration string names one of {@link SOUND_KEYS}.
* @param value - candidate value from configuration or the settings document.
* @returns true when the value is an operation key.
*/
function isSoundKey(value) {
	return typeof value === "string" && SOUND_KEYS.includes(value);
}
//#endregion
//#region src/script.ts
/**
* Quote a string as an AppleScript literal. JSON escaping is the exact
* AppleScript subset (`\"` and `\\`); control characters, which AppleScript
* string literals cannot carry, become spaces first so no JSON `\n`-style
* escape ever reaches the script.
* @param value - the raw banner text.
* @returns an AppleScript string literal.
*/
function asAppleScriptString(value) {
	return JSON.stringify(value.replace(/[\u0000-\u001f\u007f]/g, " "));
}
/**
* Build the `display notification` statement for one banner.
* @param notice - the banner title and message.
* @param sound - sound to play; `none` omits the sound clause entirely.
* @returns one AppleScript statement for `osascript -e`.
*/
function notificationScript(notice, sound) {
	const soundClause = sound === "none" ? "" : ` sound name ${asAppleScriptString(sound)}`;
	return `display notification ${asAppleScriptString(notice.message)} with title ${asAppleScriptString(notice.title)}${soundClause}`;
}
//#endregion
//#region src/index.ts
/** Cordis plugin name used by loader diagnostics. */
const name = "macos-notify";
/** The managed process-tree service this plugin spawns `osascript` through. */
const inject = ["subprocess"];
const Config = Schema.object({
	notifyOnTurnEnd: Schema.boolean().default(true),
	notifyOnApproval: Schema.boolean().default(true),
	topLevelOnly: Schema.boolean().default(true),
	sounds: Schema.object({
		completed: Schema.string().default(DEFAULT_SOUNDS.completed),
		blocked: Schema.string().default(DEFAULT_SOUNDS.blocked),
		aborted: Schema.string().default(DEFAULT_SOUNDS.aborted),
		error: Schema.string().default(DEFAULT_SOUNDS.error),
		maxTokens: Schema.string().default(DEFAULT_SOUNDS.maxTokens),
		interrupted: Schema.string().default(DEFAULT_SOUNDS.interrupted),
		approval: Schema.string().default(DEFAULT_SOUNDS.approval)
	}),
	messages: Schema.object({
		completed: messageSchema("completed"),
		blocked: messageSchema("blocked"),
		aborted: messageSchema("aborted"),
		error: messageSchema("error"),
		maxTokens: messageSchema("maxTokens"),
		interrupted: messageSchema("interrupted"),
		approval: messageSchema("approval")
	})
});
/**
* Schema of the preview namespace. Every field is defaulted, so a cleared
* request resolves back to "no request" without the page writing an empty
* object.
*/
const PreviewConfig = Schema.object({
	op: Schema.string().default(""),
	nonce: Schema.number().default(0),
	sound: Schema.string().default(DEFAULT_SOUNDS.completed),
	title: Schema.string().default(""),
	message: Schema.string().default("")
});
/**
* Schema for one operation's banner text, defaulted from
* {@link DEFAULT_MESSAGES}. The return type stays inferred: annotating it
* would erase the defaults and make both template fields required input.
* @param key - operation the template belongs to.
* @returns the object schema for that operation.
*/
function messageSchema(key) {
	return Schema.object({
		title: Schema.string().default(DEFAULT_MESSAGES[key].title),
		message: Schema.string().default(DEFAULT_MESSAGES[key].message)
	});
}
/** `osascript` ships at a fixed absolute path on every macOS release. */
const OSASCRIPT = "/usr/bin/osascript";
/** Termination grace for a spawned banner; banners normally exit on their own. */
const GRACE_MS = 5e3;
/** Cap on a banner field; long failure details must not fill the banner. */
const MAX_MESSAGE_CHARS = 160;
/**
* Fill schema defaults and validate every configured sound and template.
* Called on the composition entry at load and on every settings write, so an
* unknown sound name or a non-string template fails loud instead of producing
* a wrong banner.
* @param config - composition entry or resolved settings section.
* @returns the section with defaults filled, sounds narrowed to {@link SoundName}.
* @throws {Error} when a configured sound or template value is invalid.
*/
function resolveSettings(config) {
	const configuredSounds = config.sounds ?? {};
	const sounds = {};
	for (const key of SOUND_KEYS) sounds[key] = resolveSound(key, configuredSounds[key]);
	return {
		notifyOnTurnEnd: config.notifyOnTurnEnd ?? true,
		notifyOnApproval: config.notifyOnApproval ?? true,
		topLevelOnly: config.topLevelOnly ?? true,
		sounds,
		messages: resolveMessages(config.messages)
	};
}
/**
* Narrow one configured sound, naming the offending field when it is not a
* macOS alert sound.
* @param key - operation field being resolved.
* @param value - configured value, absent when the field inherits its default.
* @returns the validated sound name.
*/
function resolveSound(key, value) {
	if (value === void 0) return DEFAULT_SOUNDS[key];
	if (isSoundName(value)) return value;
	throw new Error(`dsh-macos-notify: sounds.${key} is not a macOS alert sound: ${JSON.stringify(value)}; use one of ${SOUND_NAMES.join(", ")}`);
}
/**
* Fill every operation's banner text and reject a field that is not a string.
* @param configured - messages layer from the composition entry or settings.
* @returns one resolved template per operation.
*/
function resolveMessages(configured) {
	const messages = {};
	for (const key of SOUND_KEYS) {
		const template = configured?.[key];
		messages[key] = {
			title: textOr(`messages.${key}.title`, template?.title, DEFAULT_MESSAGES[key].title),
			message: textOr(`messages.${key}.message`, template?.message, DEFAULT_MESSAGES[key].message)
		};
	}
	return messages;
}
/**
* Read one configured template field.
* @param field - field path used in the failure message.
* @param value - configured value, absent when the field inherits its default.
* @param fallback - default text.
* @returns the configured or default text.
*/
function textOr(field, value, fallback) {
	if (value === void 0) return fallback;
	if (typeof value === "string") return value;
	throw new Error(`dsh-macos-notify: ${field} must be a string, received ${typeof value}`);
}
/**
* The sound a turn-end reason plays. Unknown (merge-extended) kinds have no
* own setting and fall through to the `completed` entry, as does its text.
* @param reason - the `turn/end` reason appended by the agent loop.
* @returns the operation key to play and render.
*/
function soundKeyOf(reason) {
	switch (reason.kind) {
		case "completed": return "completed";
		case "blocked": return "blocked";
		case "aborted": return "aborted";
		case "error": return "error";
		case "max-tokens": return "maxTokens";
		case "interrupted": return "interrupted";
		default: return "completed";
	}
}
/**
* Placeholder values a turn-end banner exposes: `{turn}` always, `{error}` on
* a failure, `{cause}` on a cancellation.
* @param reason - the `turn/end` reason appended by the agent loop.
* @param turn - the closed turn's number.
* @returns the value table for template substitution.
*/
function turnEndValues(reason, turn) {
	return {
		turn: String(turn),
		...reason.kind === "error" ? { error: truncate(reason.error.message) } : {},
		...reason.kind === "aborted" ? { cause: reason.reason.kind } : {}
	};
}
/**
* Placeholder values an approval banner exposes: `{tool}` always, `{reason}`
* with the asker's reason, or the word `approval` when none was given.
* @param req - the pending approval decision being dispatched.
* @returns the value table for template substitution.
*/
function approvalValues(req) {
	return {
		tool: req.toolName,
		reason: req.reason === void 0 ? "approval" : truncate(req.reason)
	};
}
/**
* Render one banner from its template and placeholder values.
* @param template - the operation's resolved title and message.
* @param values - placeholder values for this firing.
* @returns the banner content, with the body bounded to the banner cap.
*/
function renderNotice(template, values) {
	return {
		title: truncate(renderTemplate(template.title, values)),
		message: truncate(renderTemplate(template.message, values))
	};
}
/**
* Bound a banner field to the cap, eliding the tail.
* @param value - the full text.
* @returns the value unchanged when short enough, else a truncated tail.
*/
function truncate(value) {
	if (value.length <= MAX_MESSAGE_CHARS) return value;
	return `${value.slice(0, MAX_MESSAGE_CHARS - 1)}…`;
}
/**
* Spawn one `display notification` banner, fire-and-forget. The banner exits
* on its own; a failed spawn or a non-zero exit is logged as a warning, never
* surfaced to the caller or the model.
* @param ctx - the plugin context whose subprocess seam runs the banner.
* @param sound - sound the banner plays; `none` keeps it silent.
* @param notice - the banner content.
*/
function notify(ctx, sound, notice) {
	const spec = {
		argv: [
			OSASCRIPT,
			"-e",
			notificationScript(notice, sound)
		],
		cwd: process.cwd(),
		stdio: {
			stdin: "ignore",
			stdout: "inherit",
			stderr: "inherit"
		},
		graceMs: GRACE_MS
	};
	try {
		ctx.subprocess.spawn(spec).done.catch((error) => {
			ctx.logger.warn(`macos-notify: osascript banner failed: ${error}`);
		});
	} catch (error) {
		ctx.logger.warn(`macos-notify: could not start osascript: ${error}`);
	}
}
/**
* Register the notification listeners and the settings namespace. Each
* listener observes without answering or changing anything: the
* `session/event` observer only reads the `turn/end` reason, and the
* `approval/request` waterfall listener always delegates with `next()` so it
* never claims a decision. Every listener resolves the settings source at
* event time, so a sound or text changed on the settings page applies to the
* next banner without a reload.
* @param ctx - the plugin context.
* @param config - the composition entry for the `macos-notify` namespace.
* @throws {Error} when the host is not macOS or the entry config is invalid.
*/
function apply(ctx, config) {
	if (process.platform !== "darwin") throw new Error(`dsh-macos-notify requires macOS: osascript Notification Center banners are unavailable on "${process.platform}"`);
	resolveSettings(config);
	let source = () => config;
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, Config, config, {
			setSource: (current) => {
				source = current;
			},
			onChange: () => {},
			validate: (value) => {
				resolveSettings(value);
			}
		});
		installPreview(ctx, settingsCtx.settings);
	});
	ctx.on("session/event", (session, event) => {
		if (event.type !== "turn/end") return;
		const settings = resolveSettings(source());
		if (!settings.notifyOnTurnEnd) return;
		if (settings.topLevelOnly && isDelegated(session)) return;
		const key = soundKeyOf(event.data.reason);
		const values = turnEndValues(event.data.reason, event.data.turn);
		notify(ctx, settings.sounds[key], renderNotice(settings.messages[key], values));
	});
	ctx.on("approval/request", (req, next) => {
		const settings = resolveSettings(source());
		if (settings.notifyOnApproval && !(settings.topLevelOnly && isDelegated(req.agent.session))) notify(ctx, settings.sounds.approval, renderNotice(settings.messages.approval, approvalValues(req)));
		return next();
	});
}
/**
* Wire the preview namespace: the settings page writes one request there, the
* Host fires that banner, then drops the request again.
*
* The document is durable and a preview is not configuration, so a fired
* request is cleared rather than left in `settings.yaml`. The clear is
* skipped when a newer request already replaced the one that fired, and the
* nonce carried by each request is what makes "newer" decidable.
* @param ctx - the plugin context whose subprocess seam runs the banner.
* @param settings - the settings service holding the preview namespace.
*/
function installPreview(ctx, settings) {
	const previews = settings.register(PREVIEW_NAMESPACE, PreviewConfig);
	let fired = previews.get().nonce;
	previews.watch((request) => {
		if (!isSoundKey(request.op) || request.nonce === 0 || request.nonce === fired) return;
		fired = request.nonce;
		notify(ctx, isSoundName(request.sound) ? request.sound : DEFAULT_SOUNDS[request.op], {
			title: truncate(request.title),
			message: truncate(request.message)
		});
		if (previews.get().nonce !== request.nonce) return;
		settings.replace(PREVIEW_NAMESPACE, {}).catch((error) => {
			ctx.logger.warn(`macos-notify: could not clear the preview request: ${error}`);
		});
	});
}
/**
* Whether a session is a subagent child. `delegationDepth` is the durable
* subagent marker (absent or zero for a top-level session, parent depth + 1
* for a child); a user fork carries `parentSession` but no depth, so it stays
* top-level.
* @param session - the session being classified.
* @returns true only when the session belongs to delegated subagent work.
*/
function isDelegated(session) {
	return (session.header.delegationDepth ?? 0) > 0;
}
//#endregion
export { Config, DEFAULT_MESSAGES, DEFAULT_SOUNDS, PLACEHOLDERS, PREVIEW_NAMESPACE, PreviewConfig, SETTINGS_NAMESPACE, SOUND_KEYS, SOUND_NAMES, SYSTEM_SOUNDS, apply, approvalValues, asAppleScriptString, inject, isSoundKey, isSoundName, name, notificationScript, notify, renderNotice, renderTemplate, resolveSettings, soundKeyOf, turnEndValues };
