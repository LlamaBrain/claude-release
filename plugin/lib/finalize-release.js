// claude-release bundled output — DO NOT EDIT. Source in src/.
import { createRequire as __cr } from 'node:module';
const require = __cr(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/semver/internal/constants.js
var require_constants = __commonJS({
  "node_modules/semver/internal/constants.js"(exports, module) {
    "use strict";
    var SEMVER_SPEC_VERSION = "2.0.0";
    var MAX_LENGTH = 256;
    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
    9007199254740991;
    var MAX_SAFE_COMPONENT_LENGTH = 16;
    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
    var RELEASE_TYPES = [
      "major",
      "premajor",
      "minor",
      "preminor",
      "patch",
      "prepatch",
      "prerelease"
    ];
    module.exports = {
      MAX_LENGTH,
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_SAFE_INTEGER,
      RELEASE_TYPES,
      SEMVER_SPEC_VERSION,
      FLAG_INCLUDE_PRERELEASE: 1,
      FLAG_LOOSE: 2
    };
  }
});

// node_modules/semver/internal/debug.js
var require_debug = __commonJS({
  "node_modules/semver/internal/debug.js"(exports, module) {
    "use strict";
    var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module.exports = debug;
  }
});

// node_modules/semver/internal/re.js
var require_re = __commonJS({
  "node_modules/semver/internal/re.js"(exports, module) {
    "use strict";
    var {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = require_constants();
    var debug = require_debug();
    exports = module.exports = {};
    var re = exports.re = [];
    var safeRe = exports.safeRe = [];
    var src = exports.src = [];
    var safeSrc = exports.safeSrc = [];
    var t = exports.t = {};
    var R = 0;
    var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    var safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    var makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    var createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index = R++;
      debug(name, index, value);
      t[name] = index;
      src[index] = value;
      safeSrc[index] = safe;
      re[index] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
    createToken("FULL", `^${src[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
    createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src[t.COERCE], true);
    createToken("COERCERTLFULL", src[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
    exports.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  }
});

// node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS({
  "node_modules/semver/internal/parse-options.js"(exports, module) {
    "use strict";
    var looseOption = Object.freeze({ loose: true });
    var emptyOpts = Object.freeze({});
    var parseOptions = (options) => {
      if (!options) {
        return emptyOpts;
      }
      if (typeof options !== "object") {
        return looseOption;
      }
      return options;
    };
    module.exports = parseOptions;
  }
});

// node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS({
  "node_modules/semver/internal/identifiers.js"(exports, module) {
    "use strict";
    var numeric = /^[0-9]+$/;
    var compareIdentifiers = (a, b) => {
      if (typeof a === "number" && typeof b === "number") {
        return a === b ? 0 : a < b ? -1 : 1;
      }
      const anum = numeric.test(a);
      const bnum = numeric.test(b);
      if (anum && bnum) {
        a = +a;
        b = +b;
      }
      return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
    };
    var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
    module.exports = {
      compareIdentifiers,
      rcompareIdentifiers
    };
  }
});

// node_modules/semver/classes/semver.js
var require_semver = __commonJS({
  "node_modules/semver/classes/semver.js"(exports, module) {
    "use strict";
    var debug = require_debug();
    var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
    var { safeRe: re, t } = require_re();
    var parseOptions = require_parse_options();
    var { compareIdentifiers } = require_identifiers();
    var SemVer = class _SemVer {
      constructor(version2, options) {
        options = parseOptions(options);
        if (version2 instanceof _SemVer) {
          if (version2.loose === !!options.loose && version2.includePrerelease === !!options.includePrerelease) {
            return version2;
          } else {
            version2 = version2.version;
          }
        } else if (typeof version2 !== "string") {
          throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version2}".`);
        }
        if (version2.length > MAX_LENGTH) {
          throw new TypeError(
            `version is longer than ${MAX_LENGTH} characters`
          );
        }
        debug("SemVer", version2, options);
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        const m = version2.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
        if (!m) {
          throw new TypeError(`Invalid Version: ${version2}`);
        }
        this.raw = version2;
        this.major = +m[1];
        this.minor = +m[2];
        this.patch = +m[3];
        if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
          throw new TypeError("Invalid major version");
        }
        if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
          throw new TypeError("Invalid minor version");
        }
        if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
          throw new TypeError("Invalid patch version");
        }
        if (!m[4]) {
          this.prerelease = [];
        } else {
          this.prerelease = m[4].split(".").map((id) => {
            if (/^[0-9]+$/.test(id)) {
              const num = +id;
              if (num >= 0 && num < MAX_SAFE_INTEGER) {
                return num;
              }
            }
            return id;
          });
        }
        this.build = m[5] ? m[5].split(".") : [];
        this.format();
      }
      format() {
        this.version = `${this.major}.${this.minor}.${this.patch}`;
        if (this.prerelease.length) {
          this.version += `-${this.prerelease.join(".")}`;
        }
        return this.version;
      }
      toString() {
        return this.version;
      }
      compare(other) {
        debug("SemVer.compare", this.version, this.options, other);
        if (!(other instanceof _SemVer)) {
          if (typeof other === "string" && other === this.version) {
            return 0;
          }
          other = new _SemVer(other, this.options);
        }
        if (other.version === this.version) {
          return 0;
        }
        return this.compareMain(other) || this.comparePre(other);
      }
      compareMain(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.major < other.major) {
          return -1;
        }
        if (this.major > other.major) {
          return 1;
        }
        if (this.minor < other.minor) {
          return -1;
        }
        if (this.minor > other.minor) {
          return 1;
        }
        if (this.patch < other.patch) {
          return -1;
        }
        if (this.patch > other.patch) {
          return 1;
        }
        return 0;
      }
      comparePre(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.prerelease.length && !other.prerelease.length) {
          return -1;
        } else if (!this.prerelease.length && other.prerelease.length) {
          return 1;
        } else if (!this.prerelease.length && !other.prerelease.length) {
          return 0;
        }
        let i = 0;
        do {
          const a = this.prerelease[i];
          const b = other.prerelease[i];
          debug("prerelease compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      compareBuild(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        let i = 0;
        do {
          const a = this.build[i];
          const b = other.build[i];
          debug("build compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      // preminor will bump the version up to the next minor release, and immediately
      // down to pre-release. premajor and prepatch work the same way.
      inc(release, identifier, identifierBase) {
        if (release.startsWith("pre")) {
          if (!identifier && identifierBase === false) {
            throw new Error("invalid increment argument: identifier is empty");
          }
          if (identifier) {
            const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
            if (!match || match[1] !== identifier) {
              throw new Error(`invalid identifier: ${identifier}`);
            }
          }
        }
        switch (release) {
          case "premajor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor = 0;
            this.major++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "preminor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "prepatch":
            this.prerelease.length = 0;
            this.inc("patch", identifier, identifierBase);
            this.inc("pre", identifier, identifierBase);
            break;
          // If the input is a non-prerelease version, this acts the same as
          // prepatch.
          case "prerelease":
            if (this.prerelease.length === 0) {
              this.inc("patch", identifier, identifierBase);
            }
            this.inc("pre", identifier, identifierBase);
            break;
          case "release":
            if (this.prerelease.length === 0) {
              throw new Error(`version ${this.raw} is not a prerelease`);
            }
            this.prerelease.length = 0;
            break;
          case "major":
            if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
              this.major++;
            }
            this.minor = 0;
            this.patch = 0;
            this.prerelease = [];
            break;
          case "minor":
            if (this.patch !== 0 || this.prerelease.length === 0) {
              this.minor++;
            }
            this.patch = 0;
            this.prerelease = [];
            break;
          case "patch":
            if (this.prerelease.length === 0) {
              this.patch++;
            }
            this.prerelease = [];
            break;
          // This probably shouldn't be used publicly.
          // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
          case "pre": {
            const base = Number(identifierBase) ? 1 : 0;
            if (this.prerelease.length === 0) {
              this.prerelease = [base];
            } else {
              let i = this.prerelease.length;
              while (--i >= 0) {
                if (typeof this.prerelease[i] === "number") {
                  this.prerelease[i]++;
                  i = -2;
                }
              }
              if (i === -1) {
                if (identifier === this.prerelease.join(".") && identifierBase === false) {
                  throw new Error("invalid increment argument: identifier already exists");
                }
                this.prerelease.push(base);
              }
            }
            if (identifier) {
              let prerelease = [identifier, base];
              if (identifierBase === false) {
                prerelease = [identifier];
              }
              if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
                if (isNaN(this.prerelease[1])) {
                  this.prerelease = prerelease;
                }
              } else {
                this.prerelease = prerelease;
              }
            }
            break;
          }
          default:
            throw new Error(`invalid increment argument: ${release}`);
        }
        this.raw = this.format();
        if (this.build.length) {
          this.raw += `+${this.build.join(".")}`;
        }
        return this;
      }
    };
    module.exports = SemVer;
  }
});

// node_modules/semver/functions/parse.js
var require_parse = __commonJS({
  "node_modules/semver/functions/parse.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var parse = (version2, options, throwErrors = false) => {
      if (version2 instanceof SemVer) {
        return version2;
      }
      try {
        return new SemVer(version2, options);
      } catch (er) {
        if (!throwErrors) {
          return null;
        }
        throw er;
      }
    };
    module.exports = parse;
  }
});

// node_modules/semver/functions/valid.js
var require_valid = __commonJS({
  "node_modules/semver/functions/valid.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var valid = (version2, options) => {
      const v = parse(version2, options);
      return v ? v.version : null;
    };
    module.exports = valid;
  }
});

// node_modules/semver/functions/clean.js
var require_clean = __commonJS({
  "node_modules/semver/functions/clean.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var clean = (version2, options) => {
      const s = parse(version2.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    };
    module.exports = clean;
  }
});

// node_modules/semver/functions/inc.js
var require_inc = __commonJS({
  "node_modules/semver/functions/inc.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var inc = (version2, release, options, identifier, identifierBase) => {
      if (typeof options === "string") {
        identifierBase = identifier;
        identifier = options;
        options = void 0;
      }
      try {
        return new SemVer(
          version2 instanceof SemVer ? version2.version : version2,
          options
        ).inc(release, identifier, identifierBase).version;
      } catch (er) {
        return null;
      }
    };
    module.exports = inc;
  }
});

// node_modules/semver/functions/diff.js
var require_diff = __commonJS({
  "node_modules/semver/functions/diff.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var diff = (version1, version2) => {
      const v1 = parse(version1, null, true);
      const v2 = parse(version2, null, true);
      const comparison = v1.compare(v2);
      if (comparison === 0) {
        return null;
      }
      const v1Higher = comparison > 0;
      const highVersion = v1Higher ? v1 : v2;
      const lowVersion = v1Higher ? v2 : v1;
      const highHasPre = !!highVersion.prerelease.length;
      const lowHasPre = !!lowVersion.prerelease.length;
      if (lowHasPre && !highHasPre) {
        if (!lowVersion.patch && !lowVersion.minor) {
          return "major";
        }
        if (lowVersion.compareMain(highVersion) === 0) {
          if (lowVersion.minor && !lowVersion.patch) {
            return "minor";
          }
          return "patch";
        }
      }
      const prefix = highHasPre ? "pre" : "";
      if (v1.major !== v2.major) {
        return prefix + "major";
      }
      if (v1.minor !== v2.minor) {
        return prefix + "minor";
      }
      if (v1.patch !== v2.patch) {
        return prefix + "patch";
      }
      return "prerelease";
    };
    module.exports = diff;
  }
});

// node_modules/semver/functions/major.js
var require_major = __commonJS({
  "node_modules/semver/functions/major.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var major = (a, loose) => new SemVer(a, loose).major;
    module.exports = major;
  }
});

// node_modules/semver/functions/minor.js
var require_minor = __commonJS({
  "node_modules/semver/functions/minor.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var minor = (a, loose) => new SemVer(a, loose).minor;
    module.exports = minor;
  }
});

// node_modules/semver/functions/patch.js
var require_patch = __commonJS({
  "node_modules/semver/functions/patch.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var patch = (a, loose) => new SemVer(a, loose).patch;
    module.exports = patch;
  }
});

// node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS({
  "node_modules/semver/functions/prerelease.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var prerelease = (version2, options) => {
      const parsed = parse(version2, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    };
    module.exports = prerelease;
  }
});

// node_modules/semver/functions/compare.js
var require_compare = __commonJS({
  "node_modules/semver/functions/compare.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
    module.exports = compare;
  }
});

// node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS({
  "node_modules/semver/functions/rcompare.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var rcompare = (a, b, loose) => compare(b, a, loose);
    module.exports = rcompare;
  }
});

// node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS({
  "node_modules/semver/functions/compare-loose.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var compareLoose = (a, b) => compare(a, b, true);
    module.exports = compareLoose;
  }
});

// node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS({
  "node_modules/semver/functions/compare-build.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var compareBuild = (a, b, loose) => {
      const versionA = new SemVer(a, loose);
      const versionB = new SemVer(b, loose);
      return versionA.compare(versionB) || versionA.compareBuild(versionB);
    };
    module.exports = compareBuild;
  }
});

// node_modules/semver/functions/sort.js
var require_sort = __commonJS({
  "node_modules/semver/functions/sort.js"(exports, module) {
    "use strict";
    var compareBuild = require_compare_build();
    var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
    module.exports = sort;
  }
});

// node_modules/semver/functions/rsort.js
var require_rsort = __commonJS({
  "node_modules/semver/functions/rsort.js"(exports, module) {
    "use strict";
    var compareBuild = require_compare_build();
    var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
    module.exports = rsort;
  }
});

// node_modules/semver/functions/gt.js
var require_gt = __commonJS({
  "node_modules/semver/functions/gt.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var gt = (a, b, loose) => compare(a, b, loose) > 0;
    module.exports = gt;
  }
});

// node_modules/semver/functions/lt.js
var require_lt = __commonJS({
  "node_modules/semver/functions/lt.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var lt = (a, b, loose) => compare(a, b, loose) < 0;
    module.exports = lt;
  }
});

// node_modules/semver/functions/eq.js
var require_eq = __commonJS({
  "node_modules/semver/functions/eq.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var eq = (a, b, loose) => compare(a, b, loose) === 0;
    module.exports = eq;
  }
});

// node_modules/semver/functions/neq.js
var require_neq = __commonJS({
  "node_modules/semver/functions/neq.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var neq = (a, b, loose) => compare(a, b, loose) !== 0;
    module.exports = neq;
  }
});

// node_modules/semver/functions/gte.js
var require_gte = __commonJS({
  "node_modules/semver/functions/gte.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var gte = (a, b, loose) => compare(a, b, loose) >= 0;
    module.exports = gte;
  }
});

// node_modules/semver/functions/lte.js
var require_lte = __commonJS({
  "node_modules/semver/functions/lte.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var lte = (a, b, loose) => compare(a, b, loose) <= 0;
    module.exports = lte;
  }
});

// node_modules/semver/functions/cmp.js
var require_cmp = __commonJS({
  "node_modules/semver/functions/cmp.js"(exports, module) {
    "use strict";
    var eq = require_eq();
    var neq = require_neq();
    var gt = require_gt();
    var gte = require_gte();
    var lt = require_lt();
    var lte = require_lte();
    var cmp = (a, op, b, loose) => {
      switch (op) {
        case "===":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a === b;
        case "!==":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a !== b;
        case "":
        case "=":
        case "==":
          return eq(a, b, loose);
        case "!=":
          return neq(a, b, loose);
        case ">":
          return gt(a, b, loose);
        case ">=":
          return gte(a, b, loose);
        case "<":
          return lt(a, b, loose);
        case "<=":
          return lte(a, b, loose);
        default:
          throw new TypeError(`Invalid operator: ${op}`);
      }
    };
    module.exports = cmp;
  }
});

// node_modules/semver/functions/coerce.js
var require_coerce = __commonJS({
  "node_modules/semver/functions/coerce.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var parse = require_parse();
    var { safeRe: re, t } = require_re();
    var coerce = (version2, options) => {
      if (version2 instanceof SemVer) {
        return version2;
      }
      if (typeof version2 === "number") {
        version2 = String(version2);
      }
      if (typeof version2 !== "string") {
        return null;
      }
      options = options || {};
      let match = null;
      if (!options.rtl) {
        match = version2.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
      } else {
        const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
        let next;
        while ((next = coerceRtlRegex.exec(version2)) && (!match || match.index + match[0].length !== version2.length)) {
          if (!match || next.index + next[0].length !== match.index + match[0].length) {
            match = next;
          }
          coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
        }
        coerceRtlRegex.lastIndex = -1;
      }
      if (match === null) {
        return null;
      }
      const major = match[2];
      const minor = match[3] || "0";
      const patch = match[4] || "0";
      const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
      const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
      return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
    };
    module.exports = coerce;
  }
});

// node_modules/semver/functions/truncate.js
var require_truncate = __commonJS({
  "node_modules/semver/functions/truncate.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var constants = require_constants();
    var SemVer = require_semver();
    var truncate = (version2, truncation, options) => {
      if (!constants.RELEASE_TYPES.includes(truncation)) {
        return null;
      }
      const clonedVersion = cloneInputVersion(version2, options);
      return clonedVersion && doTruncation(clonedVersion, truncation);
    };
    var cloneInputVersion = (version2, options) => {
      const versionStringToParse = version2 instanceof SemVer ? version2.version : version2;
      return parse(versionStringToParse, options);
    };
    var doTruncation = (version2, truncation) => {
      if (isPrerelease(truncation)) {
        return version2.version;
      }
      version2.prerelease = [];
      switch (truncation) {
        case "major":
          version2.minor = 0;
          version2.patch = 0;
          break;
        case "minor":
          version2.patch = 0;
          break;
      }
      return version2.format();
    };
    var isPrerelease = (type) => {
      return type.startsWith("pre");
    };
    module.exports = truncate;
  }
});

// node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS({
  "node_modules/semver/internal/lrucache.js"(exports, module) {
    "use strict";
    var LRUCache = class {
      constructor() {
        this.max = 1e3;
        this.map = /* @__PURE__ */ new Map();
      }
      get(key) {
        const value = this.map.get(key);
        if (value === void 0) {
          return void 0;
        } else {
          this.map.delete(key);
          this.map.set(key, value);
          return value;
        }
      }
      delete(key) {
        return this.map.delete(key);
      }
      set(key, value) {
        const deleted = this.delete(key);
        if (!deleted && value !== void 0) {
          if (this.map.size >= this.max) {
            const firstKey = this.map.keys().next().value;
            this.delete(firstKey);
          }
          this.map.set(key, value);
        }
        return this;
      }
    };
    module.exports = LRUCache;
  }
});

// node_modules/semver/classes/range.js
var require_range = __commonJS({
  "node_modules/semver/classes/range.js"(exports, module) {
    "use strict";
    var SPACE_CHARACTERS = /\s+/g;
    var Range = class _Range {
      constructor(range, options) {
        options = parseOptions(options);
        if (range instanceof _Range) {
          if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
            return range;
          } else {
            return new _Range(range.raw, options);
          }
        }
        if (range instanceof Comparator) {
          this.raw = range.value;
          this.set = [[range]];
          this.formatted = void 0;
          return this;
        }
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
        this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
        if (!this.set.length) {
          throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
        }
        if (this.set.length > 1) {
          const first = this.set[0];
          this.set = this.set.filter((c) => !isNullSet(c[0]));
          if (this.set.length === 0) {
            this.set = [first];
          } else if (this.set.length > 1) {
            for (const c of this.set) {
              if (c.length === 1 && isAny(c[0])) {
                this.set = [c];
                break;
              }
            }
          }
        }
        this.formatted = void 0;
      }
      get range() {
        if (this.formatted === void 0) {
          this.formatted = "";
          for (let i = 0; i < this.set.length; i++) {
            if (i > 0) {
              this.formatted += "||";
            }
            const comps = this.set[i];
            for (let k = 0; k < comps.length; k++) {
              if (k > 0) {
                this.formatted += " ";
              }
              this.formatted += comps[k].toString().trim();
            }
          }
        }
        return this.formatted;
      }
      format() {
        return this.range;
      }
      toString() {
        return this.range;
      }
      parseRange(range) {
        range = range.replace(BUILDSTRIPRE, "");
        const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
        const memoKey = memoOpts + ":" + range;
        const cached = cache.get(memoKey);
        if (cached) {
          return cached;
        }
        const loose = this.options.loose;
        const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
        range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
        debug("hyphen replace", range);
        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        debug("comparator trim", range);
        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
        debug("tilde trim", range);
        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
        debug("caret trim", range);
        let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
        if (loose) {
          rangeList = rangeList.filter((comp) => {
            debug("loose invalid filter", comp, this.options);
            return !!comp.match(re[t.COMPARATORLOOSE]);
          });
        }
        debug("range list", rangeList);
        const rangeMap = /* @__PURE__ */ new Map();
        const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
        for (const comp of comparators) {
          if (isNullSet(comp)) {
            return [comp];
          }
          rangeMap.set(comp.value, comp);
        }
        if (rangeMap.size > 1 && rangeMap.has("")) {
          rangeMap.delete("");
        }
        const result = [...rangeMap.values()];
        cache.set(memoKey, result);
        return result;
      }
      intersects(range, options) {
        if (!(range instanceof _Range)) {
          throw new TypeError("a Range is required");
        }
        return this.set.some((thisComparators) => {
          return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
            return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
              return rangeComparators.every((rangeComparator) => {
                return thisComparator.intersects(rangeComparator, options);
              });
            });
          });
        });
      }
      // if ANY of the sets match ALL of its comparators, then pass
      test(version2) {
        if (!version2) {
          return false;
        }
        if (typeof version2 === "string") {
          try {
            version2 = new SemVer(version2, this.options);
          } catch (er) {
            return false;
          }
        }
        for (let i = 0; i < this.set.length; i++) {
          if (testSet(this.set[i], version2, this.options)) {
            return true;
          }
        }
        return false;
      }
    };
    module.exports = Range;
    var LRU = require_lrucache();
    var cache = new LRU();
    var parseOptions = require_parse_options();
    var Comparator = require_comparator();
    var debug = require_debug();
    var SemVer = require_semver();
    var {
      safeRe: re,
      src,
      t,
      comparatorTrimReplace,
      tildeTrimReplace,
      caretTrimReplace
    } = require_re();
    var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
    var BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
    var isNullSet = (c) => c.value === "<0.0.0-0";
    var isAny = (c) => c.value === "";
    var isSatisfiable = (comparators, options) => {
      let result = true;
      const remainingComparators = comparators.slice();
      let testComparator = remainingComparators.pop();
      while (result && remainingComparators.length) {
        result = remainingComparators.every((otherComparator) => {
          return testComparator.intersects(otherComparator, options);
        });
        testComparator = remainingComparators.pop();
      }
      return result;
    };
    var parseComparator = (comp, options) => {
      comp = comp.replace(re[t.BUILD], "");
      debug("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug("caret", comp);
      comp = replaceTildes(comp, options);
      debug("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug("xrange", comp);
      comp = replaceStars(comp, options);
      debug("stars", comp);
      return comp;
    };
    var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
    var replaceTildes = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
    };
    var replaceTilde = (comp, options) => {
      const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("tilde", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
        } else if (pr) {
          debug("replaceTilde pr", pr);
          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        debug("tilde return", ret);
        return ret;
      });
    };
    var replaceCarets = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
    };
    var replaceCaret = (comp, options) => {
      debug("caret", comp, options);
      const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("caret", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          if (M === "0") {
            ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
          } else {
            ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
          }
        } else if (pr) {
          debug("replaceCaret pr", pr);
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
          }
        } else {
          debug("no pr");
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
          }
        }
        debug("caret return", ret);
        return ret;
      });
    };
    var replaceXRanges = (comp, options) => {
      debug("replaceXRanges", comp, options);
      return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
    };
    var replaceXRange = (comp, options) => {
      comp = comp.trim();
      const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
      return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        debug("xRange", comp, ret, gtlt, M, m, p, pr);
        const xM = isX(M);
        const xm = xM || isX(m);
        const xp = xm || isX(p);
        const anyX = xp;
        if (gtlt === "=" && anyX) {
          gtlt = "";
        }
        pr = options.includePrerelease ? "-0" : "";
        if (xM) {
          if (gtlt === ">" || gtlt === "<") {
            ret = "<0.0.0-0";
          } else {
            ret = "*";
          }
        } else if (gtlt && anyX) {
          if (xm) {
            m = 0;
          }
          p = 0;
          if (gtlt === ">") {
            gtlt = ">=";
            if (xm) {
              M = +M + 1;
              m = 0;
              p = 0;
            } else {
              m = +m + 1;
              p = 0;
            }
          } else if (gtlt === "<=") {
            gtlt = "<";
            if (xm) {
              M = +M + 1;
            } else {
              m = +m + 1;
            }
          }
          if (gtlt === "<") {
            pr = "-0";
          }
          ret = `${gtlt + M}.${m}.${p}${pr}`;
        } else if (xm) {
          ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
        } else if (xp) {
          ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
        }
        debug("xRange return", ret);
        return ret;
      });
    };
    var replaceStars = (comp, options) => {
      debug("replaceStars", comp, options);
      return comp.trim().replace(re[t.STAR], "");
    };
    var replaceGTE0 = (comp, options) => {
      debug("replaceGTE0", comp, options);
      return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
    };
    var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
      if (isX(fM)) {
        from = "";
      } else if (isX(fm)) {
        from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
      } else if (isX(fp)) {
        from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
      } else if (fpr) {
        from = `>=${from}`;
      } else {
        from = `>=${from}${incPr ? "-0" : ""}`;
      }
      if (isX(tM)) {
        to = "";
      } else if (isX(tm)) {
        to = `<${+tM + 1}.0.0-0`;
      } else if (isX(tp)) {
        to = `<${tM}.${+tm + 1}.0-0`;
      } else if (tpr) {
        to = `<=${tM}.${tm}.${tp}-${tpr}`;
      } else if (incPr) {
        to = `<${tM}.${tm}.${+tp + 1}-0`;
      } else {
        to = `<=${to}`;
      }
      return `${from} ${to}`.trim();
    };
    var testSet = (set, version2, options) => {
      for (let i = 0; i < set.length; i++) {
        if (!set[i].test(version2)) {
          return false;
        }
      }
      if (version2.prerelease.length && !options.includePrerelease) {
        for (let i = 0; i < set.length; i++) {
          debug(set[i].semver);
          if (set[i].semver === Comparator.ANY) {
            continue;
          }
          if (set[i].semver.prerelease.length > 0) {
            const allowed = set[i].semver;
            if (allowed.major === version2.major && allowed.minor === version2.minor && allowed.patch === version2.patch) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    };
  }
});

// node_modules/semver/classes/comparator.js
var require_comparator = __commonJS({
  "node_modules/semver/classes/comparator.js"(exports, module) {
    "use strict";
    var ANY = /* @__PURE__ */ Symbol("SemVer ANY");
    var Comparator = class _Comparator {
      static get ANY() {
        return ANY;
      }
      constructor(comp, options) {
        options = parseOptions(options);
        if (comp instanceof _Comparator) {
          if (comp.loose === !!options.loose) {
            return comp;
          } else {
            comp = comp.value;
          }
        }
        comp = comp.trim().split(/\s+/).join(" ");
        debug("comparator", comp, options);
        this.options = options;
        this.loose = !!options.loose;
        this.parse(comp);
        if (this.semver === ANY) {
          this.value = "";
        } else {
          this.value = this.operator + this.semver.version;
        }
        debug("comp", this);
      }
      parse(comp) {
        const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
        const m = comp.match(r);
        if (!m) {
          throw new TypeError(`Invalid comparator: ${comp}`);
        }
        this.operator = m[1] !== void 0 ? m[1] : "";
        if (this.operator === "=") {
          this.operator = "";
        }
        if (!m[2]) {
          this.semver = ANY;
        } else {
          this.semver = new SemVer(m[2], this.options.loose);
        }
      }
      toString() {
        return this.value;
      }
      test(version2) {
        debug("Comparator.test", version2, this.options.loose);
        if (this.semver === ANY || version2 === ANY) {
          return true;
        }
        if (typeof version2 === "string") {
          try {
            version2 = new SemVer(version2, this.options);
          } catch (er) {
            return false;
          }
        }
        return cmp(version2, this.operator, this.semver, this.options);
      }
      intersects(comp, options) {
        if (!(comp instanceof _Comparator)) {
          throw new TypeError("a Comparator is required");
        }
        if (this.operator === "") {
          if (this.value === "") {
            return true;
          }
          return new Range(comp.value, options).test(this.value);
        } else if (comp.operator === "") {
          if (comp.value === "") {
            return true;
          }
          return new Range(this.value, options).test(comp.semver);
        }
        options = parseOptions(options);
        if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
          return false;
        }
        if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
          return false;
        }
        if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
          return true;
        }
        if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
          return true;
        }
        if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
          return true;
        }
        if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
          return true;
        }
        if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
          return true;
        }
        return false;
      }
    };
    module.exports = Comparator;
    var parseOptions = require_parse_options();
    var { safeRe: re, t } = require_re();
    var cmp = require_cmp();
    var debug = require_debug();
    var SemVer = require_semver();
    var Range = require_range();
  }
});

// node_modules/semver/functions/satisfies.js
var require_satisfies = __commonJS({
  "node_modules/semver/functions/satisfies.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var satisfies = (version2, range, options) => {
      try {
        range = new Range(range, options);
      } catch (er) {
        return false;
      }
      return range.test(version2);
    };
    module.exports = satisfies;
  }
});

// node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS({
  "node_modules/semver/ranges/to-comparators.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
    module.exports = toComparators;
  }
});

// node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS({
  "node_modules/semver/ranges/max-satisfying.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var maxSatisfying = (versions, range, options) => {
      let max = null;
      let maxSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!max || maxSV.compare(v) === -1) {
            max = v;
            maxSV = new SemVer(max, options);
          }
        }
      });
      return max;
    };
    module.exports = maxSatisfying;
  }
});

// node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS({
  "node_modules/semver/ranges/min-satisfying.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var minSatisfying = (versions, range, options) => {
      let min = null;
      let minSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!min || minSV.compare(v) === 1) {
            min = v;
            minSV = new SemVer(min, options);
          }
        }
      });
      return min;
    };
    module.exports = minSatisfying;
  }
});

// node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS({
  "node_modules/semver/ranges/min-version.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var gt = require_gt();
    var minVersion = (range, loose) => {
      range = new Range(range, loose);
      let minver = new SemVer("0.0.0");
      if (range.test(minver)) {
        return minver;
      }
      minver = new SemVer("0.0.0-0");
      if (range.test(minver)) {
        return minver;
      }
      minver = null;
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let setMin = null;
        comparators.forEach((comparator) => {
          const compver = new SemVer(comparator.semver.version);
          switch (comparator.operator) {
            case ">":
              if (compver.prerelease.length === 0) {
                compver.patch++;
              } else {
                compver.prerelease.push(0);
              }
              compver.raw = compver.format();
            /* fallthrough */
            case "":
            case ">=":
              if (!setMin || gt(compver, setMin)) {
                setMin = compver;
              }
              break;
            case "<":
            case "<=":
              break;
            /* istanbul ignore next */
            default:
              throw new Error(`Unexpected operation: ${comparator.operator}`);
          }
        });
        if (setMin && (!minver || gt(minver, setMin))) {
          minver = setMin;
        }
      }
      if (minver && range.test(minver)) {
        return minver;
      }
      return null;
    };
    module.exports = minVersion;
  }
});

// node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS({
  "node_modules/semver/ranges/valid.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var validRange = (range, options) => {
      try {
        return new Range(range, options).range || "*";
      } catch (er) {
        return null;
      }
    };
    module.exports = validRange;
  }
});

// node_modules/semver/ranges/outside.js
var require_outside = __commonJS({
  "node_modules/semver/ranges/outside.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var Range = require_range();
    var satisfies = require_satisfies();
    var gt = require_gt();
    var lt = require_lt();
    var lte = require_lte();
    var gte = require_gte();
    var outside = (version2, range, hilo, options) => {
      version2 = new SemVer(version2, options);
      range = new Range(range, options);
      let gtfn, ltefn, ltfn, comp, ecomp;
      switch (hilo) {
        case ">":
          gtfn = gt;
          ltefn = lte;
          ltfn = lt;
          comp = ">";
          ecomp = ">=";
          break;
        case "<":
          gtfn = lt;
          ltefn = gte;
          ltfn = gt;
          comp = "<";
          ecomp = "<=";
          break;
        default:
          throw new TypeError('Must provide a hilo val of "<" or ">"');
      }
      if (satisfies(version2, range, options)) {
        return false;
      }
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let high = null;
        let low = null;
        comparators.forEach((comparator) => {
          if (comparator.semver === ANY) {
            comparator = new Comparator(">=0.0.0");
          }
          high = high || comparator;
          low = low || comparator;
          if (gtfn(comparator.semver, high.semver, options)) {
            high = comparator;
          } else if (ltfn(comparator.semver, low.semver, options)) {
            low = comparator;
          }
        });
        if (high.operator === comp || high.operator === ecomp) {
          return false;
        }
        if ((!low.operator || low.operator === comp) && ltefn(version2, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version2, low.semver)) {
          return false;
        }
      }
      return true;
    };
    module.exports = outside;
  }
});

// node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS({
  "node_modules/semver/ranges/gtr.js"(exports, module) {
    "use strict";
    var outside = require_outside();
    var gtr = (version2, range, options) => outside(version2, range, ">", options);
    module.exports = gtr;
  }
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS({
  "node_modules/semver/ranges/ltr.js"(exports, module) {
    "use strict";
    var outside = require_outside();
    var ltr = (version2, range, options) => outside(version2, range, "<", options);
    module.exports = ltr;
  }
});

// node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS({
  "node_modules/semver/ranges/intersects.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var intersects = (r1, r2, options) => {
      r1 = new Range(r1, options);
      r2 = new Range(r2, options);
      return r1.intersects(r2, options);
    };
    module.exports = intersects;
  }
});

// node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS({
  "node_modules/semver/ranges/simplify.js"(exports, module) {
    "use strict";
    var satisfies = require_satisfies();
    var compare = require_compare();
    module.exports = (versions, range, options) => {
      const set = [];
      let first = null;
      let prev = null;
      const v = versions.sort((a, b) => compare(a, b, options));
      for (const version2 of v) {
        const included = satisfies(version2, range, options);
        if (included) {
          prev = version2;
          if (!first) {
            first = version2;
          }
        } else {
          if (prev) {
            set.push([first, prev]);
          }
          prev = null;
          first = null;
        }
      }
      if (first) {
        set.push([first, null]);
      }
      const ranges = [];
      for (const [min, max] of set) {
        if (min === max) {
          ranges.push(min);
        } else if (!max && min === v[0]) {
          ranges.push("*");
        } else if (!max) {
          ranges.push(`>=${min}`);
        } else if (min === v[0]) {
          ranges.push(`<=${max}`);
        } else {
          ranges.push(`${min} - ${max}`);
        }
      }
      const simplified = ranges.join(" || ");
      const original = typeof range.raw === "string" ? range.raw : String(range);
      return simplified.length < original.length ? simplified : range;
    };
  }
});

// node_modules/semver/ranges/subset.js
var require_subset = __commonJS({
  "node_modules/semver/ranges/subset.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var satisfies = require_satisfies();
    var compare = require_compare();
    var subset = (sub, dom, options = {}) => {
      if (sub === dom) {
        return true;
      }
      sub = new Range(sub, options);
      dom = new Range(dom, options);
      let sawNonNull = false;
      OUTER: for (const simpleSub of sub.set) {
        for (const simpleDom of dom.set) {
          const isSub = simpleSubset(simpleSub, simpleDom, options);
          sawNonNull = sawNonNull || isSub !== null;
          if (isSub) {
            continue OUTER;
          }
        }
        if (sawNonNull) {
          return false;
        }
      }
      return true;
    };
    var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
    var minimumVersion = [new Comparator(">=0.0.0")];
    var simpleSubset = (sub, dom, options) => {
      if (sub === dom) {
        return true;
      }
      if (sub.length === 1 && sub[0].semver === ANY) {
        if (dom.length === 1 && dom[0].semver === ANY) {
          return true;
        } else if (options.includePrerelease) {
          sub = minimumVersionWithPreRelease;
        } else {
          sub = minimumVersion;
        }
      }
      if (dom.length === 1 && dom[0].semver === ANY) {
        if (options.includePrerelease) {
          return true;
        } else {
          dom = minimumVersion;
        }
      }
      const eqSet = /* @__PURE__ */ new Set();
      let gt, lt;
      for (const c of sub) {
        if (c.operator === ">" || c.operator === ">=") {
          gt = higherGT(gt, c, options);
        } else if (c.operator === "<" || c.operator === "<=") {
          lt = lowerLT(lt, c, options);
        } else {
          eqSet.add(c.semver);
        }
      }
      if (eqSet.size > 1) {
        return null;
      }
      let gtltComp;
      if (gt && lt) {
        gtltComp = compare(gt.semver, lt.semver, options);
        if (gtltComp > 0) {
          return null;
        } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
          return null;
        }
      }
      for (const eq of eqSet) {
        if (gt && !satisfies(eq, String(gt), options)) {
          return null;
        }
        if (lt && !satisfies(eq, String(lt), options)) {
          return null;
        }
        for (const c of dom) {
          if (!satisfies(eq, String(c), options)) {
            return false;
          }
        }
        return true;
      }
      let higher, lower;
      let hasDomLT, hasDomGT;
      let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
      let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
      if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
        needDomLTPre = false;
      }
      for (const c of dom) {
        hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
        hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
        if (gt) {
          if (needDomGTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
              needDomGTPre = false;
            }
          }
          if (c.operator === ">" || c.operator === ">=") {
            higher = higherGT(gt, c, options);
            if (higher === c && higher !== gt) {
              return false;
            }
          } else if (gt.operator === ">=" && !c.test(gt.semver)) {
            return false;
          }
        }
        if (lt) {
          if (needDomLTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
              needDomLTPre = false;
            }
          }
          if (c.operator === "<" || c.operator === "<=") {
            lower = lowerLT(lt, c, options);
            if (lower === c && lower !== lt) {
              return false;
            }
          } else if (lt.operator === "<=" && !c.test(lt.semver)) {
            return false;
          }
        }
        if (!c.operator && (lt || gt) && gtltComp !== 0) {
          return false;
        }
      }
      if (gt && hasDomLT && !lt && gtltComp !== 0) {
        return false;
      }
      if (lt && hasDomGT && !gt && gtltComp !== 0) {
        return false;
      }
      if (needDomGTPre || needDomLTPre) {
        return false;
      }
      return true;
    };
    var higherGT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
    };
    var lowerLT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
    };
    module.exports = subset;
  }
});

// node_modules/semver/index.js
var require_semver2 = __commonJS({
  "node_modules/semver/index.js"(exports, module) {
    "use strict";
    var internalRe = require_re();
    var constants = require_constants();
    var SemVer = require_semver();
    var identifiers = require_identifiers();
    var parse = require_parse();
    var valid = require_valid();
    var clean = require_clean();
    var inc = require_inc();
    var diff = require_diff();
    var major = require_major();
    var minor = require_minor();
    var patch = require_patch();
    var prerelease = require_prerelease();
    var compare = require_compare();
    var rcompare = require_rcompare();
    var compareLoose = require_compare_loose();
    var compareBuild = require_compare_build();
    var sort = require_sort();
    var rsort = require_rsort();
    var gt = require_gt();
    var lt = require_lt();
    var eq = require_eq();
    var neq = require_neq();
    var gte = require_gte();
    var lte = require_lte();
    var cmp = require_cmp();
    var coerce = require_coerce();
    var truncate = require_truncate();
    var Comparator = require_comparator();
    var Range = require_range();
    var satisfies = require_satisfies();
    var toComparators = require_to_comparators();
    var maxSatisfying = require_max_satisfying();
    var minSatisfying = require_min_satisfying();
    var minVersion = require_min_version();
    var validRange = require_valid2();
    var outside = require_outside();
    var gtr = require_gtr();
    var ltr = require_ltr();
    var intersects = require_intersects();
    var simplifyRange = require_simplify();
    var subset = require_subset();
    module.exports = {
      parse,
      valid,
      clean,
      inc,
      diff,
      major,
      minor,
      patch,
      prerelease,
      compare,
      rcompare,
      compareLoose,
      compareBuild,
      sort,
      rsort,
      gt,
      lt,
      eq,
      neq,
      gte,
      lte,
      cmp,
      coerce,
      truncate,
      Comparator,
      Range,
      satisfies,
      toComparators,
      maxSatisfying,
      minSatisfying,
      minVersion,
      validRange,
      outside,
      gtr,
      ltr,
      intersects,
      simplifyRange,
      subset,
      SemVer,
      re: internalRe.re,
      src: internalRe.src,
      tokens: internalRe.t,
      SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
      RELEASE_TYPES: constants.RELEASE_TYPES,
      compareIdentifiers: identifiers.compareIdentifiers,
      rcompareIdentifiers: identifiers.rcompareIdentifiers
    };
  }
});

// node_modules/conventional-commits-parser/lib/parser.js
var require_parser = __commonJS({
  "node_modules/conventional-commits-parser/lib/parser.js"(exports, module) {
    "use strict";
    var CATCH_ALL = /()(.+)/gi;
    var SCISSOR = "# ------------------------ >8 ------------------------";
    function trimOffNewlines(input) {
      const result = input.match(/[^\r\n]/);
      if (!result) {
        return "";
      }
      const firstIndex = result.index;
      let lastIndex = input.length - 1;
      while (input[lastIndex] === "\r" || input[lastIndex] === "\n") {
        lastIndex--;
      }
      return input.substring(firstIndex, lastIndex + 1);
    }
    function append(src, line) {
      if (src) {
        src += "\n" + line;
      } else {
        src = line;
      }
      return src;
    }
    function getCommentFilter(char) {
      return function(line) {
        return line.charAt(0) !== char;
      };
    }
    function truncateToScissor(lines) {
      const scissorIndex = lines.indexOf(SCISSOR);
      if (scissorIndex === -1) {
        return lines;
      }
      return lines.slice(0, scissorIndex);
    }
    function getReferences(input, regex) {
      const references = [];
      let referenceSentences;
      let referenceMatch;
      const reApplicable = input.match(regex.references) !== null ? regex.references : CATCH_ALL;
      while (referenceSentences = reApplicable.exec(input)) {
        const action = referenceSentences[1] || null;
        const sentence = referenceSentences[2];
        while (referenceMatch = regex.referenceParts.exec(sentence)) {
          let owner = null;
          let repository = referenceMatch[1] || "";
          const ownerRepo = repository.split("/");
          if (ownerRepo.length > 1) {
            owner = ownerRepo.shift();
            repository = ownerRepo.join("/");
          }
          const reference = {
            action,
            owner,
            repository: repository || null,
            issue: referenceMatch[3],
            raw: referenceMatch[0],
            prefix: referenceMatch[2]
          };
          references.push(reference);
        }
      }
      return references;
    }
    function passTrough() {
      return true;
    }
    function parser(raw, options, regex) {
      if (!raw || !raw.trim()) {
        throw new TypeError("Expected a raw commit");
      }
      if (!options || typeof options === "object" && !Object.keys(options).length) {
        throw new TypeError("Expected options");
      }
      if (!regex) {
        throw new TypeError("Expected regex");
      }
      let currentProcessedField;
      let mentionsMatch;
      const otherFields = {};
      const commentFilter = typeof options.commentChar === "string" ? getCommentFilter(options.commentChar) : passTrough;
      const gpgFilter = (line) => !line.match(/^\s*gpg:/);
      const rawLines = trimOffNewlines(raw).split(/\r?\n/);
      const lines = truncateToScissor(rawLines).filter(commentFilter).filter(gpgFilter);
      let continueNote = false;
      let isBody = true;
      const headerCorrespondence = options.headerCorrespondence?.map(function(part) {
        return part.trim();
      }) || [];
      const revertCorrespondence = options.revertCorrespondence?.map(function(field) {
        return field.trim();
      }) || [];
      const mergeCorrespondence = options.mergeCorrespondence?.map(function(field) {
        return field.trim();
      }) || [];
      let body = null;
      let footer = null;
      let header = null;
      const mentions = [];
      let merge = null;
      const notes = [];
      const references = [];
      let revert = null;
      if (lines.length === 0) {
        return {
          body,
          footer,
          header,
          mentions,
          merge,
          notes,
          references,
          revert,
          scope: null,
          subject: null,
          type: null
        };
      }
      merge = lines.shift();
      const mergeParts = {};
      const headerParts = {};
      body = "";
      footer = "";
      const mergeMatch = merge.match(options.mergePattern);
      if (mergeMatch && options.mergePattern) {
        merge = mergeMatch[0];
        header = lines.shift();
        while (header !== void 0 && !header.trim()) {
          header = lines.shift();
        }
        if (!header) {
          header = "";
        }
        mergeCorrespondence.forEach(function(partName, index) {
          const partValue = mergeMatch[index + 1] || null;
          mergeParts[partName] = partValue;
        });
      } else {
        header = merge;
        merge = null;
        mergeCorrespondence.forEach(function(partName) {
          mergeParts[partName] = null;
        });
      }
      const headerMatch = header.match(options.headerPattern);
      if (headerMatch) {
        headerCorrespondence.forEach(function(partName, index) {
          const partValue = headerMatch[index + 1] || null;
          headerParts[partName] = partValue;
        });
      } else {
        headerCorrespondence.forEach(function(partName) {
          headerParts[partName] = null;
        });
      }
      references.push(...getReferences(header, {
        references: regex.references,
        referenceParts: regex.referenceParts
      }));
      lines.forEach(function(line) {
        if (options.fieldPattern) {
          const fieldMatch = options.fieldPattern.exec(line);
          if (fieldMatch) {
            currentProcessedField = fieldMatch[1];
            return;
          }
          if (currentProcessedField) {
            otherFields[currentProcessedField] = append(otherFields[currentProcessedField], line);
            return;
          }
        }
        let referenceMatched;
        const notesMatch = line.match(regex.notes);
        if (notesMatch) {
          continueNote = true;
          isBody = false;
          footer = append(footer, line);
          const note = {
            title: notesMatch[1],
            text: notesMatch[2]
          };
          notes.push(note);
          return;
        }
        const lineReferences = getReferences(line, {
          references: regex.references,
          referenceParts: regex.referenceParts
        });
        if (lineReferences.length > 0) {
          isBody = false;
          referenceMatched = true;
          continueNote = false;
        }
        Array.prototype.push.apply(references, lineReferences);
        if (referenceMatched) {
          footer = append(footer, line);
          return;
        }
        if (continueNote) {
          notes[notes.length - 1].text = append(notes[notes.length - 1].text, line);
          footer = append(footer, line);
          return;
        }
        if (isBody) {
          body = append(body, line);
        } else {
          footer = append(footer, line);
        }
      });
      if (options.breakingHeaderPattern && notes.length === 0) {
        const breakingHeader = header.match(options.breakingHeaderPattern);
        if (breakingHeader) {
          const noteText = breakingHeader[3];
          notes.push({
            title: "BREAKING CHANGE",
            text: noteText
          });
        }
      }
      while (mentionsMatch = regex.mentions.exec(raw)) {
        mentions.push(mentionsMatch[1]);
      }
      const revertMatch = raw.match(options.revertPattern);
      if (revertMatch) {
        revert = {};
        revertCorrespondence.forEach(function(partName, index) {
          const partValue = revertMatch[index + 1] || null;
          revert[partName] = partValue;
        });
      } else {
        revert = null;
      }
      notes.forEach(function(note) {
        note.text = trimOffNewlines(note.text);
      });
      const msg = {
        ...headerParts,
        ...mergeParts,
        merge,
        header,
        body: body ? trimOffNewlines(body) : null,
        footer: footer ? trimOffNewlines(footer) : null,
        notes,
        references,
        mentions,
        revert,
        ...otherFields
      };
      return msg;
    }
    module.exports = parser;
  }
});

// node_modules/conventional-commits-parser/lib/regex.js
var require_regex = __commonJS({
  "node_modules/conventional-commits-parser/lib/regex.js"(exports, module) {
    "use strict";
    var reNomatch = /(?!.*)/;
    function join(array, joiner) {
      return array.map(function(val) {
        return val.trim();
      }).filter(function(val) {
        return val.length;
      }).join(joiner);
    }
    function getNotesRegex(noteKeywords, notesPattern) {
      if (!noteKeywords) {
        return reNomatch;
      }
      const noteKeywordsSelection = join(noteKeywords, "|");
      if (!notesPattern) {
        return new RegExp("^[\\s|*]*(" + noteKeywordsSelection + ")[:\\s]+(.*)", "i");
      }
      return notesPattern(noteKeywordsSelection);
    }
    function getReferencePartsRegex(issuePrefixes, issuePrefixesCaseSensitive) {
      if (!issuePrefixes) {
        return reNomatch;
      }
      const flags = issuePrefixesCaseSensitive ? "g" : "gi";
      return new RegExp("(?:.*?)??\\s*([\\w-\\.\\/]*?)??(" + join(issuePrefixes, "|") + ")([\\w-]*\\d+)", flags);
    }
    function getReferencesRegex(referenceActions) {
      if (!referenceActions) {
        return /()(.+)/gi;
      }
      const joinedKeywords = join(referenceActions, "|");
      return new RegExp("(" + joinedKeywords + ")(?:\\s+(.*?))(?=(?:" + joinedKeywords + ")|$)", "gi");
    }
    module.exports = function(options) {
      options = options || {};
      const reNotes = getNotesRegex(options.noteKeywords, options.notesPattern);
      const reReferenceParts = getReferencePartsRegex(options.issuePrefixes, options.issuePrefixesCaseSensitive);
      const reReferences = getReferencesRegex(options.referenceActions);
      return {
        notes: reNotes,
        referenceParts: reReferenceParts,
        references: reReferences,
        mentions: /@([\w-]+)/g
      };
    };
  }
});

// node_modules/conventional-commits-parser/index.js
var require_conventional_commits_parser = __commonJS({
  "node_modules/conventional-commits-parser/index.js"(exports, module) {
    "use strict";
    var { Transform } = __require("stream");
    var parser = require_parser();
    var regex = require_regex();
    function assignOpts(options) {
      options = {
        headerPattern: /^(\w*)(?:\(([\w$.\-*/ ]*)\))?: (.*)$/,
        headerCorrespondence: ["type", "scope", "subject"],
        referenceActions: [
          "close",
          "closes",
          "closed",
          "fix",
          "fixes",
          "fixed",
          "resolve",
          "resolves",
          "resolved"
        ],
        issuePrefixes: ["#"],
        noteKeywords: ["BREAKING CHANGE", "BREAKING-CHANGE"],
        fieldPattern: /^-(.*?)-$/,
        revertPattern: /^Revert\s"([\s\S]*)"\s*This reverts commit (\w*)\./,
        revertCorrespondence: ["header", "hash"],
        warn: function() {
        },
        mergePattern: null,
        mergeCorrespondence: null,
        ...options
      };
      if (typeof options.headerPattern === "string") {
        options.headerPattern = new RegExp(options.headerPattern);
      }
      if (typeof options.headerCorrespondence === "string") {
        options.headerCorrespondence = options.headerCorrespondence.split(",");
      }
      if (typeof options.referenceActions === "string") {
        options.referenceActions = options.referenceActions.split(",");
      }
      if (typeof options.issuePrefixes === "string") {
        options.issuePrefixes = options.issuePrefixes.split(",");
      }
      if (typeof options.noteKeywords === "string") {
        options.noteKeywords = options.noteKeywords.split(",");
      }
      if (typeof options.fieldPattern === "string") {
        options.fieldPattern = new RegExp(options.fieldPattern);
      }
      if (typeof options.revertPattern === "string") {
        options.revertPattern = new RegExp(options.revertPattern);
      }
      if (typeof options.revertCorrespondence === "string") {
        options.revertCorrespondence = options.revertCorrespondence.split(",");
      }
      if (typeof options.mergePattern === "string") {
        options.mergePattern = new RegExp(options.mergePattern);
      }
      return options;
    }
    function conventionalCommitsParser(options) {
      options = assignOpts(options);
      const reg = regex(options);
      return new Transform({
        objectMode: true,
        highWaterMark: 16,
        transform(data, enc, cb) {
          let commit;
          try {
            commit = parser(data.toString(), options, reg);
            cb(null, commit);
          } catch (err) {
            if (options.warn === true) {
              cb(err);
            } else {
              options.warn(err.toString());
              cb(null, "");
            }
          }
        }
      });
    }
    function sync(commit, options) {
      options = assignOpts(options);
      const reg = regex(options);
      return parser(commit, options, reg);
    }
    module.exports = conventionalCommitsParser;
    module.exports.sync = sync;
  }
});

// src/finalize-release.js
import { execFileSync as execFileSync3 } from "node:child_process";
import { readFileSync as readFileSync4 } from "node:fs";
import { basename as basename2 } from "node:path";

// src/prepare-artifacts.js
import { readFileSync as readFileSync2 } from "node:fs";
import { basename } from "node:path";

// src/verify-output.js
import { readFileSync } from "node:fs";
var KEEP_A_CHANGELOG_HEADERS = /* @__PURE__ */ new Set([
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security"
]);
var EDITORIALIZE_PATTERNS = [
  /\bsignificantly\b/i,
  /\bdramatically\b/i,
  /\bmassively\b/i,
  /\bworld[-\s]?class\b/i,
  /\bbest[-\s]?in[-\s]?class\b/i,
  /\bblazingly\b/i,
  /\bTODO\b/,
  /\bFIXME\b/
];
function parseArgs(argv) {
  const args = { coverage: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--manifest") args.manifest = argv[++i];
    else if (argv[i] === "--section") args.section = argv[++i];
    else if (argv[i] === "--coverage") args.coverage = true;
  }
  return args;
}
function hashMatches(reference, knownHashes) {
  if (knownHashes.has(reference)) return true;
  for (const h of knownHashes) {
    if (h.startsWith(reference) || reference.startsWith(h)) return true;
  }
  return false;
}
function isValidRef(token, knownHashes, nextVersion) {
  if (nextVersion && token === nextVersion) return true;
  if (/^[0-9a-f]{7,40}$/.test(token)) return hashMatches(token, knownHashes);
  return false;
}
function checkCoverage(manifest, section) {
  const sectionLower = section.toLowerCase();
  const hashRefs = new Set(
    [...section.matchAll(/\(([0-9a-f]{7,40})\)/g)].map((m) => m[1].toLowerCase())
  );
  function commitCovered(c) {
    const hash = (c.squash_hash ?? c.hash ?? "").toLowerCase();
    if (hash) {
      for (const t of hashRefs) {
        if (t === hash || t.startsWith(hash) || hash.startsWith(t)) return true;
      }
    }
    const keywords = (c.subject ?? "").toLowerCase().split(/\W+/).filter((w) => w.length >= 5);
    return keywords.some((w) => sectionLower.includes(w));
  }
  const byScope = /* @__PURE__ */ new Map();
  for (const c of manifest.commits ?? []) {
    const key = c.scope || "(no scope)";
    if (!byScope.has(key)) byScope.set(key, []);
    byScope.get(key).push(c);
  }
  const errors = [];
  for (const [scope, commits] of byScope) {
    if (commits.some(commitCovered)) continue;
    const examples = commits.slice(0, 3).map((c) => `${c.hash} ${c.subject ?? ""}`.trim()).join("; ");
    const n = commits.length;
    errors.push(`Coverage: scope "${scope}" (${n} commit${n === 1 ? "" : "s"}) not surfaced \u2014 e.g. ${examples}`);
  }
  return errors;
}
function verify(manifest, section, { coverage = false } = {}) {
  const errors = [];
  const knownHashes = new Set(manifest.commits.flatMap((c) => [c.hash, c.squash_hash].filter(Boolean)));
  const nextVersion = manifest.next_version;
  const refPattern = /\(([0-9a-f]{7,40}|v\d+\.\d+\.\d+[\w.\-+]*)\)/g;
  const refTokens = [...section.matchAll(refPattern)];
  for (const m of refTokens) {
    if (!isValidRef(m[1], knownHashes, nextVersion)) {
      errors.push(`Reference (${m[1]}) is not a known commit hash and does not equal next_version (${nextVersion}).`);
    }
  }
  for (const line of section.split("\n")) {
    if (/^\s*[-*]\s/.test(line) && !/\(([0-9a-f]{7,40}|v\d+\.\d+\.\d+[\w.\-+]*)\)\s*$/.test(line)) {
      errors.push(`Bullet missing trailing reference: "${line.trim()}"`);
    }
  }
  for (const line of section.split("\n")) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m && !KEEP_A_CHANGELOG_HEADERS.has(m[1])) {
      errors.push(`Header "${m[1]}" is not a Keep-a-Changelog v1.1.0 group.`);
    }
  }
  const allBodies = manifest.commits.map((c) => `${c.subject || ""}
${c.body || ""}`).join("\n");
  for (const pat of EDITORIALIZE_PATTERNS) {
    if (pat.test(section) && !pat.test(allBodies)) {
      errors.push(`Editorializing match (${pat}) not supported by any commit body.`);
    }
  }
  if (coverage) {
    errors.push(...checkCoverage(manifest, section));
  }
  return errors;
}
var isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("verify-output.js");
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest || !args.section) {
    console.error("Usage: verify-output.js --manifest <manifest.json> --section <section.md> [--coverage]");
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(args.manifest, "utf8"));
  const section = readFileSync(args.section, "utf8");
  const errors = verify(manifest, section, { coverage: args.coverage });
  if (errors.length === 0) {
    console.log("OK");
    process.exit(0);
  }
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// src/prepare-artifacts.js
var import_semver = __toESM(require_semver2(), 1);

// src/json-pointer.js
function resolveJsonPointer(doc, pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/")) throw new Error("invalid JSON pointer");
  const parts = pointer.slice(1).split("/").map((part) => {
    if (/~(?![01])/.test(part)) throw new Error("invalid JSON pointer");
    return part.replace(/~1/g, "/").replace(/~0/g, "~");
  });
  if (parts.some((part) => ["__proto__", "prototype", "constructor"].includes(part))) throw new Error("unsafe JSON pointer");
  let parent = doc;
  for (const part of parts.slice(0, -1)) {
    if (!parent || typeof parent !== "object" || !Object.hasOwn(parent, part)) throw new Error("missing JSON pointer");
    parent = parent[part];
  }
  const key = parts.at(-1);
  if (!parent || typeof parent !== "object" || !Object.hasOwn(parent, key)) throw new Error("missing JSON pointer");
  return { parent, key };
}

// src/prepare-artifacts.js
function safePath(path) {
  return typeof path === "string" && /^[A-Za-z0-9._/-]+$/.test(path) && !path.startsWith("/") && !path.split("/").some((x) => !x || x === "." || x === ".." || x.endsWith(".") || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(x));
}
function version(value) {
  if (typeof value !== "string" || !/^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(value)) throw new Error("invalid SemVer");
  if (!import_semver.default.valid(value)) throw new Error("invalid SemVer");
  return value.replace(/^v/, "");
}
function replaceSurface(surface, next, previous) {
  if (!safePath(surface.path) || typeof surface.content !== "string") throw new Error("invalid version surface");
  const allowed = (current) => {
    const normalized = version(current);
    const sameTargetPrerelease = normalized.includes("-") && normalized.split("-")[0] === next.split("-")[0];
    if (normalized !== previous && normalized !== next && !sameTargetPrerelease) throw new Error("version surface conflicts with release baseline");
    return (current.startsWith("v") ? "v" : "") + next;
  };
  if (surface.kind === "json") {
    const doc = JSON.parse(surface.content);
    const pointers = [surface.pointer, ...surface.mirrors || []];
    if (!pointers.length || new Set(pointers).size !== pointers.length) throw new Error("invalid JSON pointers");
    let changed = false;
    for (const pointer of pointers) {
      const { parent, key } = resolveJsonPointer(doc, pointer);
      if (typeof parent[key] !== "string") throw new Error("missing JSON version");
      const nextValue = allowed(parent[key]);
      if (parent[key] !== nextValue) {
        parent[key] = nextValue;
        changed = true;
      }
    }
    if (!changed) return surface.content;
    const indent = /\n([ \t]+)\S/.exec(surface.content)?.[1] || "  ";
    const eol = surface.content.includes("\r\n") ? "\r\n" : "\n";
    return JSON.stringify(doc, null, indent).replace(/\n/g, eol) + (surface.content.endsWith("\n") ? eol : "");
  }
  if (surface.kind === "literal") {
    if (typeof surface.prefix !== "string" || !surface.prefix || typeof surface.suffix !== "string" || !surface.suffix) throw new Error("literal surfaces require nonempty prefix and suffix");
    const matches2 = [];
    for (let start = surface.content.indexOf(surface.prefix); start >= 0; start = surface.content.indexOf(surface.prefix, start + 1)) {
      const valueStart = start + surface.prefix.length;
      const end = surface.content.indexOf(surface.suffix, valueStart);
      if (end < 0) continue;
      const old = surface.content.slice(valueStart, end);
      try {
        version(old);
        matches2.push({ valueStart, end, old });
      } catch {
      }
    }
    if (matches2.length !== 1) throw new Error("literal surface must match exactly once");
    const match = matches2[0];
    return surface.content.slice(0, match.valueStart) + allowed(match.old) + surface.content.slice(match.end);
  }
  const patterns = {
    text: /^(\s*)(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(\s*)$/g,
    unity: /^([ \t]*bundleVersion:[ \t]*)(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)([ \t]*)$/gm,
    doxygen: /^([ \t]*PROJECT_NUMBER[ \t]*=[ \t]*)(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)([ \t]*)$/gm
  };
  const pattern = patterns[surface.kind];
  if (!pattern) throw new Error("unsupported version surface");
  const matches = [...surface.content.matchAll(pattern)];
  if (matches.length !== 1) throw new Error("version surface must match exactly once");
  return surface.content.replace(pattern, (_, prefix, old, suffix) => prefix + allowed(old) + suffix);
}
function releaseSection(manifest) {
  const groups = /* @__PURE__ */ new Map();
  for (const commit of manifest.commits) {
    if (!/^[0-9a-f]{7,40}$/.test(commit.hash || "") || typeof commit.subject !== "string" || /[\r\n]/.test(commit.subject)) throw new Error("invalid changelog commit");
    const group = commit.breaking ? "Changed" : commit.type === "feat" ? "Added" : ["fix", "perf"].includes(commit.type) ? "Fixed" : "Changed";
    if (!groups.has(group)) groups.set(group, []);
    const ref = commit.squash_hash ? commit.squash_hash.slice(0, 7) : commit.hash;
    if (!/^[0-9a-f]{7,40}$/.test(ref)) throw new Error("invalid durable commit reference");
    groups.get(group).push(`- ${commit.subject} (${ref})`);
  }
  const marker = `<!-- captain-release baseline:${manifest.baseline_revision} target:${manifest.target_revision} -->`;
  const lines = [`## [${manifest.next_version}] - ${manifest.release_date}`, "", marker, ""];
  for (const group of ["Added", "Changed", "Fixed"]) if (groups.has(group)) lines.push(`### ${group}`, "", ...groups.get(group), "");
  return lines.join("\n").trimEnd() + "\n";
}
function prepareArtifacts({ manifest, surfaces, changelog }, { verifyNotApplicable } = {}) {
  if (!manifest || !["patch", "minor", "major"].includes(manifest.bump_kind) || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(manifest.baseline_revision || "") || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(manifest.target_revision || "") || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.release_date || "") || !Array.isArray(manifest.commits) || !manifest.commits.length) throw new Error("release manifest requires a classified exact revision range");
  const missing = [["api_analysis", manifest.api_analysis, manifest.api_diff], ...manifest.compatibility_analysis ? [["compatibility_analysis", manifest.compatibility_analysis, manifest.compatibility_diff]] : []].filter(([, analysis]) => analysis?.status !== "analyzed");
  if (missing.length) {
    const attest = typeof verifyNotApplicable === "function" ? verifyNotApplicable(manifest) : null;
    if (missing.some(([name, analysis, diff]) => {
      const reason = attest?.[name], adjudicated = manifest.adjudication?.not_applicable?.[name];
      return analysis?.status !== "unavailable" || diff !== null || typeof reason !== "string" || !reason.trim() || reason.length > 2e3 || adjudicated !== void 0 && adjudicated !== reason;
    })) throw new Error("compatibility analysis unavailable without authenticated not-applicable policy");
  }
  const next = version(manifest.next_version), previous = version(manifest.previous_version);
  if (!Array.isArray(surfaces) || !surfaces.length || !changelog || !safePath(changelog.path) || typeof changelog.content !== "string") throw new Error("invalid artifact configuration");
  const section = releaseSection(manifest);
  const errors = verify(manifest, section, { coverage: true });
  if (errors.length) throw new Error("invalid changelog: " + errors.join("; "));
  const output = /* @__PURE__ */ Object.create(null), used = /* @__PURE__ */ new Set([changelog.path]);
  for (const surface of surfaces) {
    if (used.has(surface.path)) throw new Error("duplicate artifact path");
    used.add(surface.path);
    output[surface.path] = replaceSurface(surface, next, previous);
  }
  const heading = `## [${manifest.next_version}]`;
  const occurrences = changelog.content.split("\n").filter((line) => line.startsWith(heading));
  if (occurrences.length) {
    if (occurrences.length !== 1) throw new Error("duplicate release heading");
    const start = changelog.content.indexOf(heading);
    const end = changelog.content.indexOf("\n## ", start + heading.length);
    const existing = changelog.content.slice(start, end < 0 ? void 0 : end).trim();
    const normalize = (value) => value.replace(/^(## \[[^\]]+\] - )\d{4}-\d{2}-\d{2}/, "$1DATE").trim();
    if (normalize(existing) !== normalize(section)) throw new Error("existing release version conflicts with this revision");
    output[changelog.path] = changelog.content;
  } else {
    const match = /^((?:# [^\r\n]+|[@\\]page[ \t]+[A-Za-z_][A-Za-z0-9_.:-]*[ \t]+[^\r\n\t ][^\r\n]*)\r?\n)/.exec(changelog.content);
    if (!match) throw new Error("changelog must start with a title");
    const tail = changelog.content.slice(match[1].length);
    const firstSection = /^## /m.exec(tail);
    const insertion = firstSection ? match[1].length + firstSection.index : changelog.content.length;
    const preamble = changelog.content.slice(0, insertion);
    output[changelog.path] = preamble + (preamble.endsWith("\n") ? "" : "\n") + "\n" + section + "\n" + changelog.content.slice(insertion);
  }
  return { ...output };
}
var invoked = process.argv[1] && basename(process.argv[1]) === "prepare-artifacts.js";
if (invoked) {
  if (process.argv.length !== 4 || process.argv[2] !== "--request") throw new Error("usage: prepare-artifacts.js --request <json-file>");
  const request = JSON.parse(readFileSync2(process.argv[3], "utf8"));
  process.stdout.write(JSON.stringify(prepareArtifacts(request), null, 2) + "\n");
}

// src/finalize-release.js
var import_semver5 = __toESM(require_semver2(), 1);

// src/adjudicate-release.js
var import_semver4 = __toESM(require_semver2(), 1);

// src/compute-bump.js
var import_semver2 = __toESM(require_semver2(), 1);
import { execFileSync } from "node:child_process";
import { readFileSync as readFileSync3, writeFileSync } from "node:fs";

// src/parse-commits.js
var import_conventional_commits_parser = __toESM(require_conventional_commits_parser(), 1);
var VALID_TYPES = /* @__PURE__ */ new Set([
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert"
]);
function parseCommit(raw, { additionalTypes = [], strictPolicy = false } = {}) {
  if (strictPolicy && (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 1048576 || Buffer.byteLength(raw.split(/\r?\n/, 1)[0], "utf8") > 4096)) throw new Error("Captain commit message size limit exceeded");
  const semanticText = raw.replace(/^Captain-(?:Changes|Release|Provenance):[^\r\n]*$/gim, "");
  const parsed = (0, import_conventional_commits_parser.sync)(semanticText, {
    headerPattern: /^([a-z][a-z0-9-]*)(?:\(([^)]+)\))?(!)?: (.+)$/,
    headerCorrespondence: ["type", "scope", "breakingMark", "subject"],
    noteKeywords: ["BREAKING CHANGE", "BREAKING-CHANGE"],
    revertPattern: /^Revert\s"([^"]+)"\s*This reverts commit (\w+)\.?/i,
    revertCorrespondence: ["header", "hash"]
  });
  const type = parsed.type;
  const breaking = Boolean(
    parsed.breakingMark === "!" || (parsed.notes || []).some((n) => /^BREAKING[\s-]CHANGE$/.test(n.title))
  );
  const breakingDescription = (parsed.notes || []).filter((n) => /^BREAKING[\s-]CHANGE$/.test(n.title)).map((n) => n.text).join("\n") || null;
  const valid = Boolean(type && (VALID_TYPES.has(type) || additionalTypes.includes(type)) && parsed.subject && (!strictPolicy || parsed.subject.trim() && (!parsed.scope || /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(parsed.scope)) && (!breaking || breakingDescription?.trim())));
  const issues = (parsed.references || []).map((r) => `#${r.issue}`);
  return {
    valid,
    type: type || null,
    scope: parsed.scope || null,
    subject: parsed.subject || null,
    body: parsed.body || "",
    breaking,
    breaking_description: breakingDescription,
    issues,
    revert: Boolean(parsed.revert),
    raw
  };
}
var isMain2 = (() => {
  try {
    const myBasename = new URL(import.meta.url).pathname.split("/").pop();
    const invokedBasename = process.argv[1].replace(/\\/g, "/").split("/").pop();
    return myBasename === "parse-commits.js" && invokedBasename === "parse-commits.js";
  } catch {
    return false;
  }
})();
if (isMain2 && process.argv.includes("--stdin")) {
  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => buf += chunk);
  process.stdin.on("end", () => {
    const parsed = parseCommit(buf.trim());
    console.log(JSON.stringify(parsed, null, 2));
    process.exit(parsed.valid ? 0 : 1);
  });
} else if (isMain2) {
  console.error("parse-commits.js: use --stdin and pipe a commit message");
  process.exit(2);
}

// src/squash-changes.js
function expandSquashCommit(commit, options = {}) {
  const lines = (commit.raw || "").split(/\r?\n/).filter((line) => /^Captain-Changes:/i.test(line));
  if (!lines.length) return [commit];
  if (lines.length !== 1) throw new Error("duplicate Captain-Changes trailers");
  const match = /^Captain-Changes: ([A-Za-z0-9_-]+)$/.exec(lines[0]);
  if (!match) throw new Error("malformed Captain-Changes trailer");
  if (match[1].length > 2097152) throw new Error("Captain-Changes encoded size limit exceeded");
  let payload;
  try {
    const bytes = Buffer.from(match[1], "base64url");
    if (bytes.length > 1048576) throw new RangeError("Captain-Changes decoded size limit exceeded");
    if (bytes.toString("base64url") !== match[1]) throw new Error("noncanonical encoding");
    payload = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new Error("malformed Captain-Changes payload");
  }
  if (!payload || payload.schema_version !== 1 || !Array.isArray(payload.commits) || !payload.commits.length) {
    throw new Error("invalid Captain-Changes schema");
  }
  if (payload.commits.length > 512) throw new Error("Captain-Changes entry count limit exceeded");
  let messageBytes = 0;
  const seen = /* @__PURE__ */ new Set();
  const expanded = payload.commits.map((change) => {
    if (!change || typeof change.oid !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(change.oid) || seen.has(change.oid) || typeof change.message !== "string" || !change.message.trim()) {
      throw new Error("invalid or duplicate Captain-Changes entry");
    }
    if (Buffer.byteLength(change.message.split(/\r?\n/, 1)[0], "utf8") > 4096) throw new Error("Captain-Changes commit header size limit exceeded");
    messageBytes += Buffer.byteLength(change.message, "utf8");
    if (messageBytes > 1048576) throw new Error("Captain-Changes aggregate message size limit exceeded");
    if (/^Captain-Changes:/im.test(change.message)) throw new Error("nested Captain-Changes payload must be flattened");
    seen.add(change.oid);
    const parsed = parseCommit(change.message, { ...options, strictPolicy: true });
    if (!parsed.valid || parsed.breaking && !parsed.breaking_description) throw new Error("invalid Conventional Commit in Captain-Changes");
    return { hash: change.oid.slice(0, 7), full_hash: change.oid, squash_hash: commit.full_hash, squash_message: commit.raw, ...parsed };
  });
  const summary = parseCommit(commit.raw, { ...options, strictPolicy: true });
  if (!summary.valid || summary.breaking && !summary.breaking_description) throw new Error("invalid squash Conventional Commit");
  expanded.unshift({ hash: commit.full_hash.slice(0, 7), full_hash: commit.full_hash, squash_summary: true, ...summary });
  return expanded;
}

// src/compute-bump.js
function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).trim();
}
function lastTag() {
  try {
    return git("describe", "--tags", "--abbrev=0");
  } catch {
    return null;
  }
}
var HSEP = "<<<H>>>";
var CSEP = "<<<COMMIT-SEP>>>";
var PSEP = "<<<PARENTS>>>";
function commitsInRange(range, additionalTypes = [], strictPolicy = false) {
  const out = git("log", range, `--pretty=format:%H${HSEP}%P${PSEP}%B${CSEP}`);
  if (!out) return [];
  return out.split(CSEP).map((c) => c.trim()).filter(Boolean).map((chunk) => {
    const idx = chunk.indexOf(HSEP);
    const fullHash = chunk.slice(0, idx);
    const parentEnd = chunk.indexOf(PSEP, idx + HSEP.length);
    if (idx < 0 || parentEnd < 0) throw new Error("malformed Git history record");
    const parents = chunk.slice(idx + HSEP.length, parentEnd).trim().split(/\s+/).filter(Boolean);
    const message = chunk.slice(parentEnd + PSEP.length).trim();
    if (parents.length > 1 && /^Merge (?:branch|remote-tracking branch|tag) /.test(message.split(/\r?\n/, 1)[0])) {
      const tree = git("rev-parse", fullHash + "^{tree}");
      if (parents.some((parent) => git("rev-parse", parent + "^{tree}") === tree)) return null;
    }
    const parsed = parseCommit(message, { additionalTypes, strictPolicy });
    return {
      hash: fullHash.slice(0, 7),
      full_hash: fullHash,
      ...parsed
    };
  }).filter(Boolean).flatMap((commit) => expandSquashCommit(commit, { additionalTypes, strictPolicy }));
}
function applyBump(prev, kind, prereleaseId) {
  const base = prev ? prev.replace(/^v/, "") : "0.0.0";
  const coerced = import_semver2.default.coerce(base);
  const source = import_semver2.default.parse(base) ?? import_semver2.default.parse(coerced?.version) ?? import_semver2.default.parse("0.0.0");
  const sourceStr = source.version;
  const isPrev_Prerelease = source.prerelease.length > 0;
  let nextRaw;
  if (prereleaseId) {
    if (isPrev_Prerelease) {
      nextRaw = import_semver2.default.inc(sourceStr, "prerelease", prereleaseId);
    } else {
      nextRaw = import_semver2.default.inc(sourceStr, `pre${kind}`, prereleaseId);
    }
  } else if (isPrev_Prerelease) {
    nextRaw = `${source.major}.${source.minor}.${source.patch}`;
  } else {
    nextRaw = import_semver2.default.inc(sourceStr, kind);
  }
  return `v${nextRaw}`;
}
function computeBump(options = {}) {
  const prereleaseId = options.prereleaseId || null;
  const bumpOverride = options.bumpOverride || null;
  const defaults = { feat: "minor", fix: "patch", perf: "patch", docs: "none", style: "none", refactor: "none", test: "none", chore: "none", ci: "none", build: "none", revert: "none" };
  const custom = options.typeMap || {};
  if (typeof custom !== "object" || Array.isArray(custom)) throw new Error("typeMap must be an object");
  for (const [type, impact] of Object.entries(custom)) if (!/^[a-z][a-z0-9-]*$/.test(type) || !["none", "patch", "minor"].includes(impact)) throw new Error("invalid typeMap entry");
  const typeMap = Object.assign(/* @__PURE__ */ Object.create(null), defaults, custom);
  if (bumpOverride && !["major", "minor", "patch"].includes(bumpOverride)) {
    throw new Error(`bumpOverride must be one of major|minor|patch (got "${bumpOverride}")`);
  }
  if (options.advanceBaseline !== void 0 && typeof options.advanceBaseline !== "boolean") throw new Error("advanceBaseline must be boolean");
  if (options.advanceBaseline && !options.baselineRef) throw new Error("advancing requires an explicit initial baseline");
  const explicitBaseline = Boolean(options.baseline || options.baselineRef);
  if (Boolean(explicitBaseline) !== Boolean(options.target) || options.baseline && options.baselineRef) throw new Error("one baseline and target must be supplied together");
  if (!options.baselineRef && (options.baselineVersion || options.baselineSurface || options.baselinePointer)) throw new Error("initial baseline version and surface require baselineRef");
  let prev = lastTag();
  let baselineRevision = null;
  let baselineKind = null;
  let initialBaseline = null, baselineTag = null, baselineTagObject = null;
  let targetRevision = git("rev-parse", "--verify", "HEAD^{commit}");
  let range;
  if (options.baselineRef) {
    if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(options.baselineRef) || typeof options.baselineVersion !== "string" || !/^v?\d+\.\d+\.\d+$/.test(options.baselineVersion) || !import_semver2.default.valid(options.baselineVersion)) throw new Error("initial baseline requires an exact OID and stable version");
    if (typeof options.baselineSurface !== "string" || !/^[A-Za-z0-9._/-]+$/.test(options.baselineSurface) || options.baselineSurface.startsWith("/") || options.baselineSurface.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("invalid initial baseline surface");
    if (typeof options.target !== "string" || options.target.startsWith("-")) throw new Error("invalid target revision");
    baselineRevision = git("rev-parse", "--verify", options.baselineRef + "^{commit}");
    const surface = git("show", baselineRevision + ":" + options.baselineSurface);
    let surfaceVersion = surface;
    if (options.baselinePointer) {
      const { parent, key } = resolveJsonPointer(JSON.parse(surface), options.baselinePointer);
      if (typeof parent[key] !== "string") throw new Error("initial baseline JSON version must be a string");
      surfaceVersion = parent[key];
    }
    surfaceVersion = surfaceVersion.replace(/^v/, "");
    if (surfaceVersion !== options.baselineVersion.replace(/^v/, "")) throw new Error("initial baseline version does not match the committed surface");
    prev = options.baselineVersion;
    baselineKind = "declared_initial";
    targetRevision = git("rev-parse", "--verify", options.target + "^{commit}");
    try {
      git("merge-base", "--is-ancestor", baselineRevision, targetRevision);
    } catch {
      throw new Error("baseline is not an ancestor of target");
    }
    if (options.advanceBaseline) {
      initialBaseline = { revision: baselineRevision, version: options.baselineVersion, surface: options.baselineSurface, ...options.baselinePointer !== void 0 ? { pointer: options.baselinePointer } : {} };
      const candidates = git("tag", "--merged", targetRevision, "--list").split(/\r?\n/).flatMap((tag) => {
        if (!import_semver2.default.valid(tag) || import_semver2.default.prerelease(tag) || !import_semver2.default.gt(tag, options.baselineVersion)) return [];
        const object = git("rev-parse", "--verify", "refs/tags/" + tag);
        if (git("cat-file", "-t", object) !== "tag") return [];
        const revision = git("rev-parse", "--verify", object + "^{commit}");
        try {
          git("merge-base", "--is-ancestor", initialBaseline.revision, revision);
          git("merge-base", "--is-ancestor", revision, targetRevision);
        } catch {
          return [];
        }
        return [{ tag, object, revision }];
      }).sort((a, b) => import_semver2.default.rcompare(a.tag, b.tag));
      if (candidates.length > 1 && import_semver2.default.compare(candidates[0].tag, candidates[1].tag) === 0) throw new Error("ambiguous latest stable SemVer tags after initial baseline");
      if (candidates.length) {
        prev = baselineTag = candidates[0].tag;
        baselineTagObject = candidates[0].object;
        baselineRevision = candidates[0].revision;
        baselineKind = "latest_stable_after_initial";
      }
    }
    range = baselineRevision + ".." + targetRevision;
  } else if (options.baseline) {
    if (typeof options.target !== "string" || options.target.startsWith("-")) throw new Error("invalid target revision");
    targetRevision = git("rev-parse", "--verify", options.target + "^{commit}");
    if (options.baseline === "latest-stable") {
      const tags = git("tag", "--merged", targetRevision, "--list").split(/\r?\n/).filter((tag) => import_semver2.default.valid(tag) && !import_semver2.default.prerelease(tag));
      if (!tags.length) throw new Error("no reachable stable SemVer tag; configure an explicit initial baseline");
      tags.sort((a, b) => import_semver2.default.rcompare(a, b));
      if (tags.length > 1 && import_semver2.default.compare(tags[0], tags[1]) === 0) throw new Error("ambiguous latest stable SemVer tags");
      prev = tags[0];
      baselineKind = "latest_stable";
    } else {
      if (typeof options.baseline !== "string" || !import_semver2.default.valid(options.baseline) || import_semver2.default.prerelease(options.baseline)) throw new Error("baseline must be a stable SemVer tag");
      prev = options.baseline;
      baselineKind = "stable_tag";
    }
    baselineRevision = git("rev-parse", "--verify", "refs/tags/" + prev + "^{commit}");
    try {
      git("merge-base", "--is-ancestor", baselineRevision, targetRevision);
    } catch {
      throw new Error("baseline is not an ancestor of target");
    }
    range = baselineRevision + ".." + targetRevision;
  } else {
    if (prev) baselineRevision = git("rev-parse", "--verify", prev + "^{commit}");
    range = prev ? prev + "..HEAD" : "HEAD";
  }
  let commits = commitsInRange(range, Object.keys(typeMap), explicitBaseline);
  if (options.previewWrapper !== void 0) {
    const wrapper = options.previewWrapper;
    if (!explicitBaseline || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(wrapper || "") || wrapper !== targetRevision || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(options.compatibilityBase || "")) throw new Error("preview wrapper requires exact target and compatibility base");
    const object = git("cat-file", "-p", wrapper);
    const header = object.split("\n\n", 1)[0];
    const expected = `tree ${git("rev-parse", wrapper + "^{tree}")}
parent ${options.compatibilityBase}
author Captain Preview <captain-preview@invalid> 0 +0000
committer Captain Preview <captain-preview@invalid> 0 +0000`;
    if (header !== expected || !object.startsWith(header + "\n\nchore(landing): refresh approved feature\n\n")) throw new Error("preview wrapper is not the deterministic Captain object");
    const lines = object.slice((header + "\n\nchore(landing): refresh approved feature\n\n").length).split("\n");
    if (lines.some((line) => !/^(?:(?:Implements|Completes|Needs-QA|Captain-Run):[ \t]+\S(?:[^\r\n]*\S)?|Captain-Changes: [A-Za-z0-9_-]+)$/.test(line))) throw new Error("preview wrapper contains unexpected semantic content");
    const wrappers = commits.filter((commit) => commit.full_hash === wrapper && commit.squash_summary);
    if (wrappers.length !== 1 || !commits.some((commit) => commit.squash_hash === wrapper)) throw new Error("preview wrapper lacks validated semantic children");
    commits = commits.filter((commit) => !(commit.full_hash === wrapper && commit.squash_summary));
  }
  if (explicitBaseline && baselineRevision) {
    const released = /* @__PURE__ */ new Map();
    const normalize = (value) => (value || "").replace(/\r\n/g, "\n").split("\n").filter((line) => !/^Captain-Changes:/i.test(line)).join("\n").trim();
    for (const entry of commitsInRange(baselineRevision, Object.keys(typeMap), false)) {
      const message = normalize(entry.raw), existing = released.get(entry.full_hash);
      if (existing !== void 0 && existing !== message) throw new Error("conflicting released semantic commit " + entry.full_hash);
      released.set(entry.full_hash, message);
    }
    commits = commits.filter((entry) => {
      const existing = released.get(entry.full_hash);
      if (existing === void 0) return true;
      if (existing !== normalize(entry.raw)) throw new Error("semantic commit conflicts with released baseline " + entry.full_hash);
      return false;
    });
  }
  const seenSource = /* @__PURE__ */ new Set();
  for (const commit of commits) {
    if (explicitBaseline && (!commit.valid || commit.breaking && !commit.breaking_description)) throw new Error("invalid Conventional Commit " + commit.full_hash);
    if (seenSource.has(commit.full_hash)) throw new Error("duplicate semantic commit " + commit.full_hash);
    seenSource.add(commit.full_hash);
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const prevIsPrerelease = prev ? (import_semver2.default.prerelease(prev.replace(/^v/, "")) || []).length > 0 : false;
  if (commits.length === 0) {
    if (bumpOverride) {
      const next2 = applyBump(prev, bumpOverride, prereleaseId);
      return {
        previous_version: prev,
        baseline_revision: baselineRevision,
        baseline_kind: baselineKind,
        type_map: typeMap,
        target_revision: targetRevision,
        ...options.previewWrapper ? { preview_wrapper: options.previewWrapper } : {},
        ...initialBaseline ? { initial_baseline: initialBaseline, baseline_tag: baselineTag, baseline_tag_object: baselineTagObject } : {},
        next_version: next2,
        bump_kind: bumpOverride,
        bump_reason: `no commits since last tag; explicit --bump ${bumpOverride}`,
        release_date: today,
        commits: [],
        api_diff: { added: [], removed: [], changed: [] },
        breaking_changes: [],
        prerelease_id: prereleaseId,
        previous_is_prerelease: prevIsPrerelease,
        bump_override: bumpOverride
      };
    }
    return {
      previous_version: prev,
      baseline_revision: baselineRevision,
      baseline_kind: baselineKind,
      type_map: typeMap,
      target_revision: targetRevision,
      ...options.previewWrapper ? { preview_wrapper: options.previewWrapper } : {},
      ...initialBaseline ? { initial_baseline: initialBaseline, baseline_tag: baselineTag, baseline_tag_object: baselineTagObject } : {},
      next_version: prev,
      bump_kind: "none",
      bump_reason: "no commits since last tag",
      release_date: today,
      commits: [],
      api_diff: { added: [], removed: [], changed: [] },
      breaking_changes: [],
      prerelease_id: prereleaseId,
      previous_is_prerelease: prevIsPrerelease
    };
  }
  const revertTargets = new Set(
    commits.filter((c) => c.revert).map((c) => {
      const m = /This reverts commit (\w+)\.?/i.exec(c.raw || "");
      return m ? m[1].slice(0, 7) : null;
    }).filter(Boolean)
  );
  const filtered = commits.filter((c) => !c.revert && !revertTargets.has(c.hash));
  const breaking = filtered.filter((c) => c.breaking);
  const ranks2 = { none: 0, patch: 1, minor: 2, major: 3 };
  let kind = breaking.length ? "major" : "none";
  let reason = breaking.length ? `${breaking.length} breaking change(s)` : "non-breaking commit type mapping";
  for (const commit of filtered) {
    const impact = typeMap[commit.type] || "none";
    if (ranks2[impact] > ranks2[kind]) kind = impact;
  }
  if (bumpOverride && ranks2[bumpOverride] > ranks2[kind]) {
    kind = bumpOverride;
    reason += `; raised by explicit --bump ${bumpOverride}`;
  }
  const next = kind === "none" ? prev : applyBump(prev, kind, prereleaseId);
  if (prereleaseId) {
    reason = `${reason}; pre-release id "${prereleaseId}"${prevIsPrerelease ? " (incremented)" : " (entered)"}`;
  } else if (prevIsPrerelease && kind !== "none") {
    reason = `${reason}; graduating ${prev} \u2192 stable (commit signal "${kind}" is informational only)`;
    kind = "graduate";
  }
  return {
    previous_version: prev,
    baseline_revision: baselineRevision,
    baseline_kind: baselineKind,
    type_map: typeMap,
    target_revision: targetRevision,
    ...options.previewWrapper ? { preview_wrapper: options.previewWrapper } : {},
    ...initialBaseline ? { initial_baseline: initialBaseline, baseline_tag: baselineTag, baseline_tag_object: baselineTagObject } : {},
    next_version: next,
    bump_kind: kind,
    bump_reason: reason,
    release_date: today,
    commits: filtered,
    api_diff: { added: [], removed: [], changed: [] },
    breaking_changes: breaking.map((c) => ({
      hash: c.hash,
      subject: c.subject,
      description: c.breaking_description
    })),
    prerelease_id: prereleaseId,
    previous_is_prerelease: prevIsPrerelease,
    ...bumpOverride ? { bump_override: bumpOverride } : {}
  };
}
function parseCliOptions(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--prerelease" || a === "--pre") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        process.stderr.write(`error: ${a} requires an identifier (e.g. ${a} rc)
`);
        process.exit(2);
      }
      out.prereleaseId = next;
      i++;
    } else if (a === "--advance-baseline") {
      out.advanceBaseline = true;
    } else if (["--baseline", "--target", "--baseline-ref", "--baseline-version", "--baseline-surface", "--baseline-pointer"].includes(a)) {
      const next = argv[++i];
      if (!next || next.startsWith("--")) throw new Error(a + " requires a value");
      const keys = { "--baseline": "baseline", "--target": "target", "--baseline-ref": "baselineRef", "--baseline-version": "baselineVersion", "--baseline-surface": "baselineSurface", "--baseline-pointer": "baselinePointer" };
      out[keys[a]] = next;
    } else if (a === "--type-map") {
      const path = argv[++i];
      if (!path || path.startsWith("--")) throw new Error("--type-map requires a JSON file");
      out.typeMap = JSON.parse(readFileSync3(path, "utf8"));
    } else if (a === "--bump") {
      const next = argv[i + 1];
      if (!next || !["major", "minor", "patch"].includes(next)) {
        process.stderr.write(`error: --bump requires major|minor|patch (got "${next ?? ""}")
`);
        process.exit(2);
      }
      out.bumpOverride = next;
      i++;
    }
  }
  return out;
}
var isMain3 = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("compute-bump.js");
if (isMain3) {
  const cli = parseCliOptions(process.argv.slice(2));
  const manifest = computeBump(cli);
  const apply = process.argv.includes("--apply");
  console.log(JSON.stringify(manifest, null, 2));
  if (apply && manifest.next_version && manifest.bump_kind !== "none") {
    writeFileSync("VERSION", `${manifest.next_version}
`, "utf8");
    process.stderr.write(`Wrote VERSION <- ${manifest.next_version}
`);
  }
}

// src/classify-api-diff.js
function splitParamTuple(inner) {
  if (!inner) return [];
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "<" || c === "(" || c === "[") depth++;
    else if (c === ">" || c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(inner.slice(start).trim());
  return parts.filter((p) => p.length > 0);
}
function splitFqnAtOpenParen(fqn) {
  const i = fqn.indexOf("(");
  if (i < 0) return null;
  if (!fqn.endsWith(")")) return null;
  return {
    prefix: fqn.slice(0, i + 1),
    // includes the '('
    inner: fqn.slice(i + 1, -1)
    // strips the trailing ')'
  };
}
function isStrictAdditiveExtension(removedParams, addedParams) {
  if (addedParams.length <= removedParams.length) return false;
  for (let i = 0; i < removedParams.length; i++) {
    if (removedParams[i] !== addedParams[i]) return false;
  }
  return true;
}
function classifyRemovedAddedPairs(apiDiff) {
  const removed = apiDiff.removed ?? [];
  const added = apiDiff.added ?? [];
  const removedByPrefix = /* @__PURE__ */ new Map();
  const addedByPrefix = /* @__PURE__ */ new Map();
  for (const entry of removed) {
    const split = splitFqnAtOpenParen(entry.fqn);
    if (!split) continue;
    const params = splitParamTuple(split.inner);
    if (!removedByPrefix.has(split.prefix)) removedByPrefix.set(split.prefix, []);
    removedByPrefix.get(split.prefix).push({ entry, params });
  }
  for (const entry of added) {
    const split = splitFqnAtOpenParen(entry.fqn);
    if (!split) continue;
    const params = splitParamTuple(split.inner);
    if (!addedByPrefix.has(split.prefix)) addedByPrefix.set(split.prefix, []);
    addedByPrefix.get(split.prefix).push({ entry, params });
  }
  const pairedRemovedFqns = /* @__PURE__ */ new Set();
  const additivePairs = [];
  for (const [prefix, removedItems] of removedByPrefix) {
    const addedItems = addedByPrefix.get(prefix);
    if (!addedItems || addedItems.length === 0) continue;
    const claimedAdded = /* @__PURE__ */ new Set();
    for (const r of removedItems) {
      for (let j = 0; j < addedItems.length; j++) {
        if (claimedAdded.has(j)) continue;
        const a = addedItems[j];
        if (isStrictAdditiveExtension(r.params, a.params)) {
          pairedRemovedFqns.add(r.entry.fqn);
          additivePairs.push({ prefix, removedEntry: r.entry, addedEntry: a.entry });
          claimedAdded.add(j);
          break;
        }
      }
    }
  }
  const realRemoved = removed.filter((e) => !pairedRemovedFqns.has(e.fqn));
  const effectiveAdded = added;
  return { realRemoved, effectiveAdded, additivePairs };
}

// src/release-classification.js
function optionalExtension(pair) {
  const signature = pair.addedEntry.signature || "";
  const open = signature.indexOf("("), close = signature.lastIndexOf(")");
  if (open < 0 || close <= open) return false;
  const added = splitParamTuple(signature.slice(open + 1, close));
  const removedFqn = pair.removedEntry.fqn || "";
  const ropen = removedFqn.indexOf("("), rclose = removedFqn.lastIndexOf(")");
  if (ropen < 0 || rclose <= ropen) return false;
  const removed = splitParamTuple(removedFqn.slice(ropen + 1, rclose));
  const appended = added.slice(removed.length);
  return appended.length > 0 && appended.every((p) => /^[^=]+\s=\s.+$/.test(p));
}
function classifyApiEvidence(commitKind, apiDiff, posture = "binary") {
  if (!["source", "binary"].includes(posture)) throw new Error("invalid API compatibility posture");
  if (!apiDiff) return { bumpKind: commitKind, status: "unavailable", reason: "API analysis unavailable" };
  const pairs = classifyRemovedAddedPairs(apiDiff);
  const additivePairs = posture === "source" ? pairs.additivePairs.filter(optionalExtension) : [];
  const accepted = new Set(additivePairs.map((pair) => pair.removedEntry));
  const realRemoved = apiDiff.removed.filter((entry) => !accepted.has(entry));
  const effectiveAdded = pairs.effectiveAdded;
  const apiKind = realRemoved.length || apiDiff.changed.length ? "major" : effectiveAdded.length ? "minor" : "none";
  const ranks2 = { none: 0, patch: 1, minor: 2, major: 3 };
  if (commitKind === "graduate") {
    return { bumpKind: commitKind, status: "analyzed", apiKind, requiresBaseline: apiKind !== "none" };
  }
  if (!(commitKind in ranks2)) throw new Error(`Unsupported bump kind: ${commitKind}`);
  return {
    bumpKind: ranks2[apiKind] > ranks2[commitKind] ? apiKind : commitKind,
    status: "analyzed",
    apiKind,
    reason: `API diff: ${realRemoved.length} removal(s), ${apiDiff.changed.length} change(s), ${effectiveAdded.length} addition(s); ${additivePairs.length} additive pair(s)`
  };
}

// src/candidate-state.js
var import_semver3 = __toESM(require_semver2(), 1);
import { execFileSync as execFileSync2 } from "node:child_process";
var fullOid = (value) => typeof value === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
var safePath2 = (value) => typeof value === "string" && /^[A-Za-z0-9._/-]+$/.test(value) && !value.startsWith("/") && !value.split("/").some((part) => !part || part === "." || part === "..");
var git2 = (...args) => execFileSync2("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
function applyCandidateState(manifest, { branchRef, expectedHead, versionPath, changelogPath, pointer } = {}) {
  if (!manifest || !fullOid(manifest.baseline_revision) || !fullOid(manifest.target_revision) || !manifest.prerelease_id || !import_semver3.default.valid(manifest.next_version) || !import_semver3.default.valid(manifest.previous_version) || import_semver3.default.prerelease(manifest.previous_version)) throw new Error("candidate requires exact stable baseline, target and prerelease version");
  if (typeof branchRef !== "string" || !branchRef.startsWith("refs/heads/") || !fullOid(expectedHead) || !safePath2(versionPath) || !safePath2(changelogPath)) throw new Error("candidate requires a branch ref, exact head and configured surfaces");
  try {
    git2("check-ref-format", branchRef);
  } catch {
    throw new Error("invalid staging branch ref");
  }
  if (git2("rev-parse", "--verify", branchRef + "^{commit}") !== expectedHead) throw new Error("staging branch changed from pinned candidate head");
  if (manifest.bump_kind === "none") return { ...manifest, candidate_state: { branch_ref: branchRef, base_revision: expectedHead, version_path: versionPath, changelog_path: changelogPath, ...pointer !== void 0 ? { pointer } : {}, previous_version: null, previous_target: null, previous_baseline: null, action: "none" } };
  if (!import_semver3.default.prerelease(manifest.next_version)) throw new Error("candidate requires prerelease version");
  const versionContent = git2("show", expectedHead + ":" + versionPath);
  let current = versionContent;
  if (pointer !== void 0) {
    const { parent, key } = resolveJsonPointer(JSON.parse(versionContent), pointer);
    current = parent[key];
  }
  if (typeof current !== "string" || !import_semver3.default.valid(current.trim())) throw new Error("staging version surface is invalid");
  current = current.trim();
  const previous = import_semver3.default.parse(current), proposed = import_semver3.default.parse(manifest.next_version), stable = import_semver3.default.parse(manifest.previous_version);
  const previousCore = `${previous.major}.${previous.minor}.${previous.patch}`, proposedCore = `${proposed.major}.${proposed.minor}.${proposed.patch}`, stableCore = `${stable.major}.${stable.minor}.${stable.patch}`;
  if (import_semver3.default.lt(previousCore, stableCore) || import_semver3.default.gt(previousCore, proposedCore)) throw new Error("staging version is stale or exceeds proposed candidate");
  let priorTarget = null, priorBaseline = null, next = manifest.next_version, action = "first";
  if (previous.prerelease.length) {
    const changelog = git2("show", expectedHead + ":" + changelogPath);
    const normalized = previous.version, escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sections = changelog.split(/(?=^## \[)/m).filter((part) => new RegExp("^## \\[v?" + escape(normalized) + "\\](?:[ \\t]|$)", "m").test(part));
    if (sections.length !== 1) throw new Error("staging candidate changelog entry is missing or ambiguous");
    const markers = [...sections[0].matchAll(/<!-- captain-release baseline:([0-9a-f]{40}(?:[0-9a-f]{24})?) target:([0-9a-f]{40}(?:[0-9a-f]{24})?) -->/g)];
    if (markers.length !== 1) throw new Error("staging candidate provenance is missing or ambiguous");
    priorBaseline = markers[0][1];
    priorTarget = markers[0][2];
    if (previousCore === proposedCore) {
      if (priorBaseline !== manifest.baseline_revision || previous.prerelease[0] !== manifest.prerelease_id) throw new Error("staging candidate baseline or identifier conflicts");
      if (priorTarget === manifest.target_revision) {
        next = "v" + previous.version;
        action = "reuse";
      } else {
        const incremented = import_semver3.default.inc(previous.version, "prerelease", manifest.prerelease_id);
        if (!incremented) throw new Error("cannot increment candidate version");
        next = "v" + incremented;
        action = "increment";
      }
    } else action = "new_series";
  } else if (previousCore !== stableCore) throw new Error("staging stable version does not match release baseline");
  return { ...manifest, next_version: next, candidate_state: { branch_ref: branchRef, base_revision: expectedHead, version_path: versionPath, changelog_path: changelogPath, ...pointer !== void 0 ? { pointer } : {}, previous_version: current, previous_target: priorTarget, previous_baseline: priorBaseline, action } };
}

// src/adjudicate-release.js
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
var ranks = { none: 0, patch: 1, minor: 2, major: 3 };
var oid = (value) => typeof value === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
function adjudicateRelease(input, reference, { verifyDecision } = {}) {
  const manifest = freeze(structuredClone(input));
  if (!manifest || manifest.adjudication || manifest.observed_classification || manifest.bump_kind !== "major" || !oid(manifest.baseline_revision) || !oid(manifest.target_revision) || !oid(manifest.compatibility_analysis?.base_revision) || manifest.compatibility_analysis.target_revision !== manifest.target_revision) throw new Error("exact unadjudicated major report required");
  if (!import_semver4.default.valid(manifest.previous_version) || import_semver4.default.prerelease(manifest.previous_version)) throw new Error("major report version does not match the stable baseline");
  const majorVersion = applyBump(manifest.previous_version, "major", manifest.prerelease_id || null);
  let candidateOptions;
  if (manifest.candidate_state) {
    const state = manifest.candidate_state;
    candidateOptions = { branchRef: state.branch_ref, expectedHead: state.base_revision, versionPath: state.version_path, changelogPath: state.changelog_path, ...state.pointer !== void 0 ? { pointer: state.pointer } : {} };
    const refreshed = applyCandidateState({ ...manifest, next_version: majorVersion }, candidateOptions);
    const keys = Object.keys(refreshed.candidate_state).sort();
    if (refreshed.next_version !== manifest.next_version || keys.length !== Object.keys(state).length || keys.some((key) => refreshed.candidate_state[key] !== state[key])) throw new Error("candidate state changed or is inconsistent with the major report");
  } else if (manifest.next_version !== majorVersion) throw new Error("major report version does not match the stable baseline");
  if (!Array.isArray(manifest.commits) || !manifest.type_map || typeof manifest.type_map !== "object" || Array.isArray(manifest.type_map)) throw new Error("release classification evidence is incomplete");
  const analyses = [["api_analysis", manifest.api_analysis, manifest.api_diff], ["compatibility_analysis", manifest.compatibility_analysis, manifest.compatibility_diff]];
  if (typeof verifyDecision !== "function") throw new Error("trusted decision verifier is required");
  const decision = verifyDecision(manifest, reference);
  if (!decision || decision.scope !== "all_findings" || decision.base !== manifest.compatibility_analysis.base_revision || decision.head !== manifest.target_revision || !/^[0-9a-f]{64}$/.test(decision.finding_sha256 || "") || !["confirm-major", "reject-major", "revise"].includes(decision.choice) || typeof decision.actor !== "string" || !decision.actor.trim() || typeof decision.justification !== "string" || decision.choice === "reject-major" && !decision.justification.trim()) throw new Error("authenticated aggregate decision does not match this report");
  const notApplicable = {};
  for (const [name, analysis, diff] of analyses) {
    if (analysis?.status === "unavailable" && diff === null) {
      const reason = decision.not_applicable?.[name];
      if (typeof reason !== "string" || !reason.trim() || reason.length > 2e3) throw new Error("compatibility analysis is unavailable without authenticated policy rationale");
      notApplicable[name] = reason;
      continue;
    }
    if (analysis?.status !== "analyzed" || !diff || !["none", "minor", "major"].includes(analysis.bump_kind) || !Array.isArray(diff.added) || !Array.isArray(diff.removed) || !Array.isArray(diff.changed)) throw new Error("compatibility analysis is unavailable or incomplete");
    if (classifyApiEvidence("none", diff, analysis.posture || "binary").apiKind !== analysis.bump_kind) throw new Error("compatibility analysis contradicts the concrete API diff");
  }
  if (!manifest.commits.some((commit) => commit.breaking === true) && !analyses.some(([, analysis]) => analysis?.bump_kind === "major") && manifest.bump_override !== "major") throw new Error("major report has no supported breaking signal");
  const reviewedFields = ["reviewed_base", "reviewed_head", "reviewed_finding_sha256"];
  const associated = reviewedFields.some((name) => decision[name] !== void 0);
  if (associated && (!oid(decision.reviewed_base) || !oid(decision.reviewed_head) || !/^[0-9a-f]{64}$/.test(decision.reviewed_finding_sha256 || ""))) throw new Error("authenticated original review provenance is incomplete");
  const evidence = { scope: decision.scope, base: decision.base, head: decision.head, finding_sha256: decision.finding_sha256, choice: decision.choice, actor: decision.actor, justification: decision.justification, ...associated ? { reviewed_base: decision.reviewed_base, reviewed_head: decision.reviewed_head, reviewed_finding_sha256: decision.reviewed_finding_sha256 } : {}, ...Object.keys(notApplicable).length ? { not_applicable: notApplicable } : {} };
  if (decision.choice === "revise") return { status: "needs_revision", manifest: null, decision: evidence };
  let effective = "major";
  if (decision.choice === "reject-major") {
    effective = "none";
    for (const commit of manifest.commits) {
      const kind = manifest.type_map[commit.type];
      if (!["none", "patch", "minor"].includes(kind)) throw new Error("commit type mapping is incomplete");
      if (ranks[kind] > ranks[effective]) effective = kind;
    }
    if (analyses.some(([, , diff]) => diff?.added?.length > 0) && ranks[effective] < ranks.minor) effective = "minor";
    if (manifest.bump_override) {
      if (!["patch", "minor", "major"].includes(manifest.bump_override)) throw new Error("invalid explicit bump override");
      if (ranks[manifest.bump_override] > ranks[effective]) effective = manifest.bump_override;
    }
  }
  let result = structuredClone(manifest);
  result.observed_classification = { bump_kind: manifest.bump_kind, next_version: manifest.next_version, bump_reason: manifest.bump_reason };
  result.adjudication = evidence;
  result.bump_kind = effective;
  result.next_version = effective === "none" ? manifest.previous_version : applyBump(manifest.previous_version, effective, manifest.prerelease_id || null);
  result.bump_reason = `${manifest.bump_reason}; authenticated aggregate compatibility decision: ${decision.choice}`;
  if (candidateOptions) result = applyCandidateState(result, candidateOptions);
  return { status: "ready", manifest: result, decision: evidence };
}

// src/finalize-release.js
function finalizeRelease({ repo = process.cwd(), manifest, releaseRevision, verifiedRevision, branchRef, surfaces, changelogPath, tag = false }, { verifySquash, verifyNotApplicable } = {}) {
  const oidPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
  if (!oidPattern.test(releaseRevision || "") || verifiedRevision !== releaseRevision) throw new Error("verification must bind the exact release commit");
  if (typeof branchRef !== "string" || !/^refs\/heads\/[A-Za-z0-9._/-]+$/.test(branchRef) || branchRef.includes("..")) throw new Error("invalid production branch ref");
  if (!manifest || typeof manifest.next_version !== "string" || !/^v\d+\.\d+\.\d+$/.test(manifest.next_version) || !import_semver5.default.valid(manifest.next_version)) throw new Error("stable release requires a v-prefixed SemVer");
  if (!oidPattern.test(manifest.target_revision || "") || !oidPattern.test(manifest.baseline_revision || "")) throw new Error("invalid release provenance");
  if (!Array.isArray(surfaces) || !surfaces.length || surfaces.some((surface) => !safePath(surface.path)) || !safePath(changelogPath)) throw new Error("safe release surfaces required");
  const git3 = (...args) => execFileSync3("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (git3("rev-parse", "--verify", releaseRevision + "^{commit}") !== releaseRevision || git3("rev-parse", "--verify", branchRef + "^{commit}") !== releaseRevision) throw new Error("release branch does not point to verified release commit");
  git3("rev-parse", "--verify", manifest.target_revision + "^{commit}");
  try {
    git3("merge-base", "--is-ancestor", manifest.target_revision, releaseRevision);
  } catch {
    const context = Object.freeze({ repo, sourceHead: manifest.target_revision, baselineRevision: manifest.baseline_revision, destination: releaseRevision, branchRef });
    if (typeof verifySquash !== "function" || verifySquash(context) !== true) throw new Error("release target is not an ancestor; authenticated landed squash verification is required");
  }
  const paths = surfaces.map((s) => s.path).concat(changelogPath);
  const changed = git3("diff", "--no-renames", "--name-only", "-z", manifest.target_revision, releaseRevision).split("\0").filter(Boolean);
  if (changed.some((path) => !paths.includes(path))) throw new Error("release commit differs from target outside configured artifacts");
  const mode = (revision, path) => {
    const listing = git3("ls-tree", "-z", revision, "--", path);
    if (!listing) return null;
    const match = /^(100644|100755) blob [0-9a-f]{40,64}\t/.exec(listing);
    if (!match) throw new Error("release artifact is not a regular Git blob");
    return match[1];
  };
  const content = (revision, path, allowNewChangelog = false) => {
    const sourceMode = mode(revision, path);
    if (!sourceMode && allowNewChangelog) return "# Changelog\n";
    if (!sourceMode) throw new Error("configured release artifact is missing from source revision");
    const bytes = execFileSync3("git", ["show", revision + ":" + path], { cwd: repo, stdio: ["ignore", "pipe", "pipe"] });
    const text = bytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("release artifact is not valid UTF-8");
    return text;
  };
  const sourceSurfaces = surfaces.map((surface) => ({ ...surface, content: content(manifest.target_revision, surface.path) }));
  const sourceChangelog = content(manifest.target_revision, changelogPath, true);
  const expected = prepareArtifacts({ manifest, surfaces: sourceSurfaces, changelog: { path: changelogPath, content: sourceChangelog } }, { verifyNotApplicable });
  for (const [path, expectedContent] of Object.entries(expected)) {
    const sourceMode = mode(manifest.target_revision, path), releaseMode = mode(releaseRevision, path);
    if (releaseMode !== (sourceMode ?? "100644") || content(releaseRevision, path) !== expectedContent) throw new Error("release artifacts do not match the source-derived manifest");
  }
  const tagName = manifest.next_version;
  let tagAction = "none";
  if (tag) {
    const ref = "refs/tags/" + tagName;
    let existingOid = null;
    try {
      existingOid = git3("rev-parse", "--verify", ref);
    } catch {
    }
    if (existingOid && (git3("cat-file", "-t", ref) !== "tag" || git3("rev-parse", "--verify", ref + "^{commit}") !== releaseRevision)) throw new Error("release tag collision");
    let tagObject = existingOid;
    if (!tagObject) {
      const ident = git3("var", "GIT_COMMITTER_IDENT");
      const object = "object " + releaseRevision + "\ntype commit\ntag " + tagName + "\ntagger " + ident + "\n\nRelease " + tagName + "\n";
      tagObject = execFileSync3("git", ["mktag"], { cwd: repo, encoding: "utf8", input: object, stdio: ["pipe", "pipe", "pipe"] }).trim();
    }
    const command = existingOid ? "verify " + ref + " " + existingOid : "create " + ref + " " + tagObject;
    const transaction = "start\nverify " + branchRef + " " + releaseRevision + "\n" + command + "\nprepare\ncommit\n";
    try {
      execFileSync3("git", ["update-ref", "--stdin"], { cwd: repo, encoding: "utf8", input: transaction, stdio: ["pipe", "pipe", "pipe"] });
    } catch {
      throw new Error("branch or tag changed during release finalization");
    }
    tagAction = existingOid ? "existing" : "created";
  }
  return { release_revision: releaseRevision, branch_ref: branchRef, tag: tagName, tag_action: tagAction };
}
var invoked2 = process.argv[1] && basename2(process.argv[1]) === "finalize-release.js";
if (invoked2) {
  const args = process.argv.slice(2);
  const makeTag = args.includes("--tag");
  const rest = args.filter((a) => a !== "--tag");
  if (rest.length !== 2 || rest[0] !== "--request") throw new Error("usage: finalize-release.js --request <json-file> [--tag]");
  const request = JSON.parse(readFileSync4(rest[1], "utf8"));
  delete request.tag;
  process.stdout.write(JSON.stringify(finalizeRelease({ ...request, tag: makeTag }), null, 2) + "\n");
}
export {
  adjudicateRelease,
  finalizeRelease,
  prepareArtifacts
};
