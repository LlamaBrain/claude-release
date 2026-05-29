#!/usr/bin/env node
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
    function join2(array, joiner) {
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
      const noteKeywordsSelection = join2(noteKeywords, "|");
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
      return new RegExp("(?:.*?)??\\s*([\\w-\\.\\/]*?)??(" + join2(issuePrefixes, "|") + ")([\\w-]*\\d+)", flags);
    }
    function getReferencesRegex(referenceActions) {
      if (!referenceActions) {
        return /()(.+)/gi;
      }
      const joinedKeywords = join2(referenceActions, "|");
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
      constructor(version, options) {
        options = parseOptions(options);
        if (version instanceof _SemVer) {
          if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
            return version;
          } else {
            version = version.version;
          }
        } else if (typeof version !== "string") {
          throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
        }
        if (version.length > MAX_LENGTH) {
          throw new TypeError(
            `version is longer than ${MAX_LENGTH} characters`
          );
        }
        debug("SemVer", version, options);
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
        if (!m) {
          throw new TypeError(`Invalid Version: ${version}`);
        }
        this.raw = version;
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
    var parse = (version, options, throwErrors = false) => {
      if (version instanceof SemVer) {
        return version;
      }
      try {
        return new SemVer(version, options);
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
    var valid = (version, options) => {
      const v = parse(version, options);
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
    var clean = (version, options) => {
      const s = parse(version.trim().replace(/^[=v]+/, ""), options);
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
    var inc = (version, release, options, identifier, identifierBase) => {
      if (typeof options === "string") {
        identifierBase = identifier;
        identifier = options;
        options = void 0;
      }
      try {
        return new SemVer(
          version instanceof SemVer ? version.version : version,
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
    var prerelease = (version, options) => {
      const parsed = parse(version, options);
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
    var coerce = (version, options) => {
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version === "number") {
        version = String(version);
      }
      if (typeof version !== "string") {
        return null;
      }
      options = options || {};
      let match = null;
      if (!options.rtl) {
        match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
      } else {
        const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
        let next;
        while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
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
    var truncate = (version, truncation, options) => {
      if (!constants.RELEASE_TYPES.includes(truncation)) {
        return null;
      }
      const clonedVersion = cloneInputVersion(version, options);
      return clonedVersion && doTruncation(clonedVersion, truncation);
    };
    var cloneInputVersion = (version, options) => {
      const versionStringToParse = version instanceof SemVer ? version.version : version;
      return parse(versionStringToParse, options);
    };
    var doTruncation = (version, truncation) => {
      if (isPrerelease(truncation)) {
        return version.version;
      }
      version.prerelease = [];
      switch (truncation) {
        case "major":
          version.minor = 0;
          version.patch = 0;
          break;
        case "minor":
          version.patch = 0;
          break;
      }
      return version.format();
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
      test(version) {
        if (!version) {
          return false;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        for (let i = 0; i < this.set.length; i++) {
          if (testSet(this.set[i], version, this.options)) {
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
    var testSet = (set, version, options) => {
      for (let i = 0; i < set.length; i++) {
        if (!set[i].test(version)) {
          return false;
        }
      }
      if (version.prerelease.length && !options.includePrerelease) {
        for (let i = 0; i < set.length; i++) {
          debug(set[i].semver);
          if (set[i].semver === Comparator.ANY) {
            continue;
          }
          if (set[i].semver.prerelease.length > 0) {
            const allowed = set[i].semver;
            if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
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
      test(version) {
        debug("Comparator.test", version, this.options.loose);
        if (this.semver === ANY || version === ANY) {
          return true;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        return cmp(version, this.operator, this.semver, this.options);
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
    var satisfies = (version, range, options) => {
      try {
        range = new Range(range, options);
      } catch (er) {
        return false;
      }
      return range.test(version);
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
    var outside = (version, range, hilo, options) => {
      version = new SemVer(version, options);
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
      if (satisfies(version, range, options)) {
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
        if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version, low.semver)) {
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
    var gtr = (version, range, options) => outside(version, range, ">", options);
    module.exports = gtr;
  }
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS({
  "node_modules/semver/ranges/ltr.js"(exports, module) {
    "use strict";
    var outside = require_outside();
    var ltr = (version, range, options) => outside(version, range, "<", options);
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
      for (const version of v) {
        const included = satisfies(version, range, options);
        if (included) {
          prev = version;
          if (!first) {
            first = version;
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

// src/smell-cli.js
import { readFileSync, existsSync as existsSync2 } from "node:fs";

// src/smell.js
import { execFileSync as execFileSync3 } from "node:child_process";

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
function parseCommit(raw) {
  const parsed = (0, import_conventional_commits_parser.sync)(raw, {
    headerPattern: /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/,
    headerCorrespondence: ["type", "scope", "breakingMark", "subject"],
    noteKeywords: ["BREAKING CHANGE", "BREAKING-CHANGE"],
    revertPattern: /^Revert\s"([^"]+)"\s*This reverts commit (\w+)\.?/i,
    revertCorrespondence: ["header", "hash"]
  });
  const type = parsed.type;
  const valid = Boolean(type && VALID_TYPES.has(type) && parsed.subject);
  const breaking = Boolean(
    parsed.breakingMark === "!" || (parsed.notes || []).some((n) => /^BREAKING[\s-]CHANGE$/.test(n.title))
  );
  const issues = (parsed.references || []).map((r) => `#${r.issue}`);
  return {
    valid,
    type: type || null,
    scope: parsed.scope || null,
    subject: parsed.subject || null,
    body: parsed.body || "",
    breaking,
    breaking_description: (parsed.notes || []).filter((n) => /^BREAKING[\s-]CHANGE$/.test(n.title)).map((n) => n.text).join("\n") || null,
    issues,
    revert: Boolean(parsed.revert),
    raw
  };
}
var isMain = (() => {
  try {
    const myBasename = new URL(import.meta.url).pathname.split("/").pop();
    const invokedBasename = process.argv[1].replace(/\\/g, "/").split("/").pop();
    return myBasename === "parse-commits.js" && invokedBasename === "parse-commits.js";
  } catch {
    return false;
  }
})();
if (isMain && process.argv.includes("--stdin")) {
  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => buf += chunk);
  process.stdin.on("end", () => {
    const parsed = parseCommit(buf.trim());
    console.log(JSON.stringify(parsed, null, 2));
    process.exit(parsed.valid ? 0 : 1);
  });
} else if (isMain) {
  console.error("parse-commits.js: use --stdin and pipe a commit message");
  process.exit(2);
}

// src/api-diff.js
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";
var WORKTREE_REF = "WORKTREE";
function warn(reason) {
  process.stderr.write(`[claude-release] api-diff skipped: ${reason}
`);
}
function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: options.encoding ?? "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    ...options
  });
}
function hasDotnet() {
  try {
    execFileSync("dotnet", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function pluginRootFromImportMeta() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}
function isIncludedCsPath(relPath) {
  if (!relPath.endsWith(".cs")) return false;
  const lower = relPath.toLowerCase();
  const segments = relPath.split("/");
  const lowerSegments = lower.split("/");
  const dirExclusions = ["packages", "library", "obj", "bin", "temp", "editor", "tests"];
  if (lowerSegments.slice(0, -1).some((s) => dirExclusions.includes(s))) return false;
  const name = segments[segments.length - 1];
  const lowerName = lowerSegments[lowerSegments.length - 1];
  if (lowerName.endsWith(".tests.cs")) return false;
  if (lowerName.endsWith(".generated.cs")) return false;
  if (lowerName.endsWith(".designer.cs")) return false;
  if (lowerName.endsWith(".g.cs")) return false;
  if (lowerName.endsWith(".g.i.cs")) return false;
  void name;
  return true;
}
function materializeGitRef(ref, destDir) {
  let listing;
  try {
    listing = runGit(["ls-tree", "-r", "--name-only", "-z", ref]);
  } catch (err) {
    throw new Error(`git ls-tree failed for ref ${ref}: ${err.message}`);
  }
  const files = listing.split("\0").filter(Boolean).map((p) => p.replace(/\\/g, "/")).filter(isIncludedCsPath);
  for (const relPath of files) {
    const outPath = join(destDir, ...relPath.split("/"));
    mkdirSync(dirname(outPath), { recursive: true });
    let content;
    try {
      content = runGit(["show", `${ref}:${relPath}`], { encoding: "buffer" });
    } catch (err) {
      throw new Error(`git show failed for ${ref}:${relPath}: ${err.message}`);
    }
    writeFileSync(outPath, content);
  }
}
function materializeWorktree(destDir) {
  let listing;
  try {
    listing = runGit(["ls-files", "-z"]);
  } catch (err) {
    throw new Error(`git ls-files failed: ${err.message}`);
  }
  const files = listing.split("\0").filter(Boolean).map((p) => p.replace(/\\/g, "/")).filter(isIncludedCsPath);
  const repoRoot = runGit(["rev-parse", "--show-toplevel"]).trim();
  for (const relPath of files) {
    const srcPath = join(repoRoot, ...relPath.split("/"));
    if (!existsSync(srcPath)) continue;
    const outPath = join(destDir, ...relPath.split("/"));
    mkdirSync(dirname(outPath), { recursive: true });
    copyFileSync(srcPath, outPath);
  }
}
function ensureBuilt(projectDir, dllPath) {
  if (existsSync(dllPath)) return;
  execFileSync(
    "dotnet",
    ["build", projectDir, "-c", "Release", "--verbosity", "quiet", "--nologo"],
    { stdio: ["ignore", "inherit", "inherit"] }
  );
}
async function tryApiDiff(previousRef, toRef) {
  if (!previousRef) return null;
  if (!hasDotnet()) return null;
  const pluginRoot = pluginRootFromImportMeta();
  const projectDir = join(pluginRoot, "lib", "dotnet", "ApiDiff");
  const dllPath = join(projectDir, "bin", "Release", "net8.0", "ApiDiff.dll");
  let tmpRoot;
  try {
    tmpRoot = mkdtempSync(join(tmpdir(), "claude-release-apidiff-"));
  } catch (err) {
    warn(`could not create temp dir: ${err.message}`);
    return null;
  }
  const prevDir = join(tmpRoot, "prev");
  const currDir = join(tmpRoot, "curr");
  mkdirSync(prevDir, { recursive: true });
  mkdirSync(currDir, { recursive: true });
  try {
    materializeGitRef(previousRef, prevDir);
    if (toRef === WORKTREE_REF) {
      materializeWorktree(currDir);
    } else {
      materializeGitRef(toRef, currDir);
    }
    let stdout;
    try {
      ensureBuilt(projectDir, dllPath);
      stdout = execFileSync(
        "dotnet",
        [dllPath, prevDir, currDir],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }
      );
    } catch (err) {
      const stderr = err.stderr?.toString?.() ?? "";
      warn(`dotnet ApiDiff failed: ${stderr.trim() || err.message}`);
      return null;
    }
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      warn(`could not parse ApiDiff output as JSON: ${err.message}`);
      return null;
    }
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.added) || !Array.isArray(parsed.removed) || !Array.isArray(parsed.changed)) {
      warn("ApiDiff output missing expected shape ({added,removed,changed})");
      return null;
    }
    return parsed;
  } catch (err) {
    warn(err.message);
    return null;
  } finally {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
    }
  }
}

// src/compute-bump.js
var import_semver = __toESM(require_semver2(), 1);
import { execFileSync as execFileSync2 } from "node:child_process";
import { writeFileSync as writeFileSync2 } from "node:fs";
function git(...args) {
  return execFileSync2("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
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
function commitsInRange(range) {
  let out;
  try {
    out = git("log", range, `--pretty=format:%H${HSEP}%B${CSEP}`);
  } catch {
    return [];
  }
  if (!out) return [];
  return out.split(CSEP).map((c) => c.trim()).filter(Boolean).map((chunk) => {
    const idx = chunk.indexOf(HSEP);
    const fullHash = chunk.slice(0, idx);
    const message = chunk.slice(idx + HSEP.length).trim();
    const parsed = parseCommit(message);
    return {
      hash: fullHash.slice(0, 7),
      full_hash: fullHash,
      ...parsed
    };
  });
}
function applyBump(prev, kind, prereleaseId) {
  const base = prev ? prev.replace(/^v/, "") : "0.0.0";
  const coerced = import_semver.default.coerce(base);
  const source = import_semver.default.parse(base) ?? import_semver.default.parse(coerced?.version) ?? import_semver.default.parse("0.0.0");
  const sourceStr = source.version;
  const isPrev_Prerelease = source.prerelease.length > 0;
  let nextRaw;
  if (prereleaseId) {
    if (isPrev_Prerelease) {
      nextRaw = import_semver.default.inc(sourceStr, "prerelease", prereleaseId);
    } else {
      nextRaw = import_semver.default.inc(sourceStr, `pre${kind}`, prereleaseId);
    }
  } else if (isPrev_Prerelease) {
    nextRaw = `${source.major}.${source.minor}.${source.patch}`;
  } else {
    nextRaw = import_semver.default.inc(sourceStr, kind);
  }
  return `v${nextRaw}`;
}
function computeBump(options = {}) {
  const prereleaseId = options.prereleaseId || null;
  const bumpOverride = options.bumpOverride || null;
  if (bumpOverride && !["major", "minor", "patch"].includes(bumpOverride)) {
    throw new Error(`bumpOverride must be one of major|minor|patch (got "${bumpOverride}")`);
  }
  const prev = lastTag();
  const range = prev ? `${prev}..HEAD` : "HEAD";
  const commits = commitsInRange(range);
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const prevIsPrerelease = prev ? (import_semver.default.prerelease(prev.replace(/^v/, "")) || []).length > 0 : false;
  if (commits.length === 0) {
    if (bumpOverride) {
      const next2 = applyBump(prev, bumpOverride, prereleaseId);
      return {
        previous_version: prev,
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
  const feats = filtered.filter((c) => c.type === "feat" && !c.breaking);
  let kind, reason;
  if (bumpOverride) {
    kind = bumpOverride;
    reason = `explicit --bump ${bumpOverride}`;
  } else if (breaking.length > 0) {
    kind = "major";
    reason = `${breaking.length} breaking change${breaking.length > 1 ? "s" : ""}`;
  } else if (feats.length > 0) {
    kind = "minor";
    reason = `${feats.length} feat commit${feats.length > 1 ? "s" : ""}, no breaking changes`;
  } else {
    kind = "patch";
    reason = `${filtered.length} non-breaking, non-feat commit${filtered.length > 1 ? "s" : ""}`;
  }
  const next = applyBump(prev, kind, prereleaseId);
  if (prereleaseId) {
    reason = `${reason}; pre-release id "${prereleaseId}"${prevIsPrerelease ? " (incremented)" : " (entered)"}`;
  } else if (prevIsPrerelease) {
    reason = `${reason}; graduating ${prev} \u2192 stable (commit signal "${kind}" is informational only)`;
    kind = "graduate";
  }
  return {
    previous_version: prev,
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
    previous_is_prerelease: prevIsPrerelease
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
var isMain2 = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("compute-bump.js");
if (isMain2) {
  const cli = parseCliOptions(process.argv.slice(2));
  const manifest = computeBump(cli);
  const apply = process.argv.includes("--apply");
  console.log(JSON.stringify(manifest, null, 2));
  if (apply && manifest.next_version && manifest.bump_kind !== "none") {
    writeFileSync2("VERSION", `${manifest.next_version}
`, "utf8");
    process.stderr.write(`Wrote VERSION <- ${manifest.next_version}
`);
  }
}

// src/smell.js
function gitOk(...args) {
  try {
    return execFileSync3("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return "";
  }
}
function lastTag2() {
  const out = gitOk("describe", "--tags", "--abbrev=0").trim();
  return out || null;
}
function getStagedInputs() {
  const paths = gitOk("diff", "--cached", "--name-only").trim().split("\n").filter(Boolean);
  const shortstat = gitOk("diff", "--cached", "--shortstat").trim();
  const files = parseInt((/(\d+) files? changed/.exec(shortstat) ?? [])[1] ?? "0", 10);
  const insertions = parseInt((/(\d+) insertions?/.exec(shortstat) ?? [])[1] ?? "0", 10);
  const deletions = parseInt((/(\d+) deletions?/.exec(shortstat) ?? [])[1] ?? "0", 10);
  return {
    mode: "staged",
    paths,
    stats: { files, insertions, deletions },
    prevRef: lastTag2(),
    toRef: "WORKTREE",
    addedLinesForPath: (p) => {
      const diff = gitOk("diff", "--cached", "--no-color", "--", p);
      return diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1)).join("\n");
    }
  };
}
function getCommitInputs(ref) {
  const paths = gitOk("diff-tree", "--no-commit-id", "--name-only", "-r", ref).trim().split("\n").filter(Boolean);
  const shortstat = gitOk("show", "--shortstat", "--format=", ref).trim();
  const files = parseInt((/(\d+) files? changed/.exec(shortstat) ?? [])[1] ?? "0", 10);
  const insertions = parseInt((/(\d+) insertions?/.exec(shortstat) ?? [])[1] ?? "0", 10);
  const deletions = parseInt((/(\d+) deletions?/.exec(shortstat) ?? [])[1] ?? "0", 10);
  const prev = gitOk("rev-parse", `${ref}~1`).trim() || null;
  return {
    mode: "commit",
    ref,
    paths,
    stats: { files, insertions, deletions },
    prevRef: prev,
    toRef: ref,
    addedLinesForPath: (p) => {
      const diff = gitOk("show", "--no-color", "--format=", ref, "--", p);
      return diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1)).join("\n");
    }
  };
}
function getCommitMessage(ref) {
  return gitOk("show", "-s", "--format=%B", ref).trim();
}
async function checkApiBreakNoMarker({ message, inputs, runApiDiff }) {
  const parsed = parseCommit(message);
  if (parsed.breaking) return null;
  if (!inputs.prevRef) return null;
  const apiDiff = await runApiDiff(inputs.prevRef, inputs.toRef);
  if (!apiDiff) return null;
  const removed = apiDiff.removed?.length ?? 0;
  const changed = apiDiff.changed?.length ?? 0;
  if (removed === 0 && changed === 0) return null;
  return {
    check: "api-break-no-marker",
    severity: "warning",
    message: "Diff modifies/removes public API but the commit message has no breaking-change marker.",
    details: {
      removed_count: removed,
      changed_count: changed,
      examples: [
        ...(apiDiff.removed ?? []).slice(0, 3).map((e) => `removed: ${e.fqn}`),
        ...(apiDiff.changed ?? []).slice(0, 3).map((e) => `changed: ${e.fqn}`)
      ],
      hint: "Add `!` after the type/scope (e.g. `feat!:`) AND a body or `BREAKING CHANGE: <what changed and how to migrate>` footer."
    }
  };
}
function checkBreakingMarkerNoDescription({ message }) {
  const parsed = parseCommit(message);
  if (!parsed.breaking) return null;
  const desc = (parsed.breaking_description ?? "").trim();
  const bodyMinusBreaking = (parsed.body ?? "").replace(/^BREAKING[ -]CHANGE:.*$/im, "").trim();
  const SUBSTANTIVE = 20;
  if (desc.length >= SUBSTANTIVE) return null;
  if (bodyMinusBreaking.length >= SUBSTANTIVE) return null;
  return {
    check: "breaking-marker-no-description",
    severity: "warning",
    message: "Breaking-change marker is present but no substantive description was provided.",
    details: {
      hint: "Add a `BREAKING CHANGE: <description>` footer or a paragraph in the body explaining what broke and how to migrate."
    }
  };
}
function checkThinSubjectOnSubstantiveDiff({ message, inputs, thresholdFiles, thresholdLoc }) {
  const parsed = parseCommit(message);
  const body = (parsed.body ?? "").trim();
  const SUBSTANTIVE = 20;
  if (body.length >= SUBSTANTIVE) return null;
  const loc = inputs.stats.insertions + inputs.stats.deletions;
  if (inputs.stats.files <= thresholdFiles && loc <= thresholdLoc) return null;
  return {
    check: "thin-subject-on-substantive-diff",
    severity: "warning",
    message: `Substantial diff (${inputs.stats.files} files, ${loc} LOC) but the commit message has no body.`,
    details: {
      files: inputs.stats.files,
      loc,
      threshold_files: thresholdFiles,
      threshold_loc: thresholdLoc,
      hint: "Add a body explaining the why/what \u2014 one or two sentences is usually enough."
    }
  };
}
function checkConventionalMalformed({ message }) {
  const parsed = parseCommit(message);
  if (parsed.valid) return null;
  return {
    check: "conventional-malformed",
    severity: "warning",
    message: "Commit message is not a valid Conventional Commit.",
    details: {
      raw_subject: (parsed.raw ?? "").split("\n")[0],
      hint: "Use the form `<type>(<scope>): <subject>` (e.g. `feat(ui): add pause panel`). Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert."
    }
  };
}
function checkScopeMismatch({ message, inputs }) {
  const parsed = parseCommit(message);
  if (!parsed.valid || !parsed.scope) return null;
  const scope = parsed.scope.toLowerCase();
  const matched = inputs.paths.some((p) => p.toLowerCase().includes(scope));
  if (matched) return null;
  return {
    check: "scope-mismatch",
    severity: "warning",
    message: `Commit scope "${scope}" does not appear in any staged path.`,
    details: {
      scope,
      paths_sample: inputs.paths.slice(0, 5),
      hint: "Either the scope is wrong, or the change is broader than the scope implies. Pick a scope that matches the most-touched area, or drop the scope."
    }
  };
}
function checkUnrelatedAreaBundling({ inputs, thresholdTopLevelDirs }) {
  if (inputs.paths.some((p) => /(?:^|\/)CHANGELOG\.md$/i.test(p))) return null;
  const topLevels = /* @__PURE__ */ new Set();
  for (const p of inputs.paths) {
    const top = p.split("/")[0];
    if (top) topLevels.add(top);
  }
  if (topLevels.size <= thresholdTopLevelDirs) return null;
  const arr = [...topLevels];
  return {
    check: "unrelated-area-bundling",
    severity: "warning",
    message: `Commit spans ${topLevels.size} top-level directories: ${arr.slice(0, 5).join(", ")}${topLevels.size > 5 ? "\u2026" : ""}.`,
    details: {
      top_level_count: topLevels.size,
      top_levels: arr,
      threshold: thresholdTopLevelDirs,
      hint: "Consider splitting into focused commits per area. Genuinely cross-cutting changes are fine; unrelated changes piggybacking on each other are not."
    }
  };
}
function checkReleaseApiBreakNotMarked({ manifest }) {
  if (!manifest) return null;
  const apiDiff = manifest.api_diff ?? {};
  const removed = apiDiff.removed ?? [];
  const changed = apiDiff.changed ?? [];
  if (removed.length === 0 && changed.length === 0) return null;
  const commits = manifest.commits ?? [];
  if (commits.some((c) => c.breaking === true)) return null;
  return {
    check: "release-api-break-not-marked",
    severity: "warning",
    message: `Public API has ${removed.length} removed and ${changed.length} changed entr${removed.length + changed.length === 1 ? "y" : "ies"}, but no commit in the release range is marked breaking.`,
    details: {
      removed_count: removed.length,
      changed_count: changed.length,
      api_examples: [
        ...removed.slice(0, 3).map((e) => `removed: ${e.fqn}`),
        ...changed.slice(0, 3).map((e) => `changed: ${e.fqn}`)
      ],
      commit_subjects: commits.slice(0, 3).map((c) => `${(c.hash ?? "").slice(0, 7)} ${c.type ?? "?"}${c.scope ? `(${c.scope})` : ""}: ${c.subject ?? ""}`.trim()),
      hint: "Strict SemVer would call this a missed major bump. Re-author the offending commit with a `!` marker and `BREAKING CHANGE:` footer, or confirm the api-diff entries are not actually public surface."
    }
  };
}
async function checkChangelogClaimsUnbacked({ inputs, runApiDiff, manifest }) {
  if (!inputs.paths.some((p) => /(?:^|\/)CHANGELOG\.md$/i.test(p))) return [];
  const changelogPath = inputs.paths.find((p) => /(?:^|\/)CHANGELOG\.md$/i.test(p));
  const added = inputs.addedLinesForPath(changelogPath);
  if (!added.trim()) return [];
  const corpus = /* @__PURE__ */ new Set();
  for (const c of manifest?.commits ?? []) {
    for (const w of `${c.subject ?? ""} ${c.body ?? ""}`.toLowerCase().split(/\W+/)) {
      if (w.length >= 5) corpus.add(w);
    }
  }
  let apiDiff = null;
  if (inputs.prevRef) apiDiff = await runApiDiff(inputs.prevRef, inputs.toRef);
  if (apiDiff) {
    const entries = [
      ...apiDiff.added ?? [],
      ...apiDiff.removed ?? [],
      ...apiDiff.changed ?? []
    ];
    for (const e of entries) {
      for (const w of (e.fqn ?? "").toLowerCase().split(/\W+/)) {
        if (w.length >= 4) corpus.add(w);
      }
    }
  }
  const warnings = [];
  for (const raw of added.split("\n")) {
    if (!/^\s*[-*]\s/.test(raw)) continue;
    const text = raw.replace(/\(([0-9a-f]{7,40}|v\d+\.\d+\.\d+[\w.\-+]*)\)\s*$/, "").replace(/^\s*[-*]\s+/, "").toLowerCase();
    const keywords = text.split(/\W+/).filter((w) => w.length >= 5);
    if (keywords.length === 0) continue;
    if (keywords.some((w) => corpus.has(w))) continue;
    warnings.push({
      check: "changelog-claims-unbacked",
      severity: "warning",
      message: `Changelog bullet not backed by any commit subject/body or api-diff entry: "${raw.trim().slice(0, 100)}"`,
      details: {
        bullet: raw.trim(),
        hint: "Either rewrite the bullet using terms that appear in the underlying commit messages, or add a commit/api-diff entry that supports the claim."
      }
    });
  }
  return warnings;
}
async function checkChangelogMissesBreakingChange({ inputs, runApiDiff, manifest }) {
  if (!inputs.paths.some((p) => /(?:^|\/)CHANGELOG\.md$/i.test(p))) return [];
  const breakingCommits = (manifest?.commits ?? []).filter((c) => c.breaking);
  let apiDiff = null;
  if (inputs.prevRef) apiDiff = await runApiDiff(inputs.prevRef, inputs.toRef);
  const apiBreaks = apiDiff ? [
    ...(apiDiff.removed ?? []).map((e) => ({ source: "removed", ...e })),
    ...(apiDiff.changed ?? []).map((e) => ({ source: "changed", ...e }))
  ] : [];
  if (breakingCommits.length === 0 && apiBreaks.length === 0) return [];
  const changelogPath = inputs.paths.find((p) => /(?:^|\/)CHANGELOG\.md$/i.test(p));
  const added = inputs.addedLinesForPath(changelogPath).toLowerCase();
  if (!added.trim()) {
    return [{
      check: "changelog-misses-breaking-change",
      severity: "warning",
      message: "CHANGELOG.md is staged but no new content was added \u2014 breaking changes cannot be surfaced.",
      details: {
        breaking_commits: breakingCommits.length,
        api_breaks: apiBreaks.length
      }
    }];
  }
  const warnings = [];
  for (const c of breakingCommits) {
    const subject = (c.subject ?? "").toLowerCase();
    const hash = (c.hash ?? "").toLowerCase();
    const matchHash = hash && added.includes(hash);
    const subjectKeywords = subject.split(/\W+/).filter((w) => w.length >= 5);
    const matchSubject = subjectKeywords.some((w) => added.includes(w));
    if (!matchHash && !matchSubject) {
      warnings.push({
        check: "changelog-misses-breaking-change",
        severity: "warning",
        message: `Breaking-change commit not surfaced in CHANGELOG: ${c.hash} ${c.subject}`,
        details: {
          source: "commit",
          commit: c.hash,
          subject: c.subject,
          breaking_description: c.breaking_description
        }
      });
    }
  }
  for (const b of apiBreaks) {
    const fqn = (b.fqn ?? "").toLowerCase();
    const sigPart = fqn.split("(")[0];
    const parts = sigPart.split(".");
    const lastPart = parts[parts.length - 1] ?? "";
    const typePart = parts.length >= 2 ? parts[parts.length - 2] : "";
    let matched = false;
    if (lastPart && lastPart.length >= 3 && added.includes(lastPart)) matched = true;
    if (!matched && typePart && typePart.length >= 3 && added.includes(typePart)) matched = true;
    if (!matched) {
      warnings.push({
        check: "changelog-misses-breaking-change",
        severity: "warning",
        message: `API ${b.source} not surfaced in CHANGELOG: ${b.kind} ${b.fqn}`,
        details: {
          source: "api_diff",
          kind: b.kind,
          fqn: b.fqn,
          api_source: b.source
        }
      });
    }
  }
  return warnings;
}
async function runSmellChecks({
  message,
  inputs,
  thresholdFiles = 5,
  thresholdLoc = 100,
  thresholdTopLevelDirs = 5,
  runApiDiff = tryApiDiff,
  manifest = null
} = {}) {
  if (!message) throw new Error("runSmellChecks: message is required");
  if (!inputs) throw new Error("runSmellChecks: inputs is required (use getStagedInputs() or getCommitInputs(ref))");
  let resolvedManifest = manifest;
  if (!resolvedManifest && inputs.paths.some((p) => /(?:^|\/)CHANGELOG\.md$/i.test(p))) {
    try {
      resolvedManifest = computeBump();
    } catch {
      resolvedManifest = null;
    }
  }
  const warnings = [];
  const add = (w) => {
    if (w) warnings.push(w);
  };
  const addAll = (ws) => {
    for (const w of ws ?? []) add(w);
  };
  add(await checkApiBreakNoMarker({ message, inputs, runApiDiff }));
  add(checkBreakingMarkerNoDescription({ message }));
  add(checkThinSubjectOnSubstantiveDiff({ message, inputs, thresholdFiles, thresholdLoc }));
  add(checkConventionalMalformed({ message }));
  add(checkScopeMismatch({ message, inputs }));
  add(checkUnrelatedAreaBundling({ inputs, thresholdTopLevelDirs }));
  add(checkReleaseApiBreakNotMarked({ manifest: resolvedManifest }));
  addAll(await checkChangelogMissesBreakingChange({ inputs, runApiDiff, manifest: resolvedManifest }));
  addAll(await checkChangelogClaimsUnbacked({ inputs, runApiDiff, manifest: resolvedManifest }));
  return { warnings };
}

// src/smell-cli.js
function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--message") {
      args.flags.message = argv[++i];
      continue;
    }
    if (a === "--staged-msg-file") {
      args.flags.stagedMsgFile = argv[++i];
      continue;
    }
    if (a === "--json") {
      args.flags.json = true;
      continue;
    }
    if (a === "--threshold-files") {
      args.flags.thresholdFiles = parseInt(argv[++i], 10);
      continue;
    }
    if (a === "--threshold-loc") {
      args.flags.thresholdLoc = parseInt(argv[++i], 10);
      continue;
    }
    if (a === "--threshold-top-level-dirs") {
      args.flags.thresholdTopLevelDirs = parseInt(argv[++i], 10);
      continue;
    }
    if (a === "--help" || a === "-h") {
      args.flags.help = true;
      continue;
    }
    args.positional.push(a);
  }
  return args;
}
function usage() {
  process.stderr.write([
    'usage: smell-cli.js (--message "<text>" | --staged-msg-file <path> | <ref>)',
    "                    [--json] [--threshold-files N] [--threshold-loc N] [--threshold-top-level-dirs N]",
    "",
    "Exit code = warning count (0 = clean).",
    ""
  ].join("\n"));
}
function fmtWarning(w, i) {
  const lines = [
    `${i + 1}. [${w.check}] ${w.message}`
  ];
  if (w.details) {
    for (const [k, v] of Object.entries(w.details)) {
      if (v === void 0 || v === null) continue;
      if (Array.isArray(v)) {
        if (v.length === 0) continue;
        lines.push(`   ${k}:`);
        for (const item of v) lines.push(`     - ${item}`);
      } else if (typeof v === "object") {
        lines.push(`   ${k}: ${JSON.stringify(v)}`);
      } else {
        lines.push(`   ${k}: ${v}`);
      }
    }
  }
  return lines.join("\n");
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.help) {
    usage();
    process.exit(0);
  }
  let message;
  let inputs;
  if (args.flags.message) {
    message = args.flags.message;
    inputs = getStagedInputs();
  } else if (args.flags.stagedMsgFile) {
    const p = args.flags.stagedMsgFile;
    if (!existsSync2(p)) {
      process.stderr.write(`smell-cli: --staged-msg-file path does not exist: ${p}
`);
      process.exit(2);
    }
    message = readFileSync(p, "utf8").replace(/^#.*$/gm, "").trim();
    inputs = getStagedInputs();
  } else if (args.positional.length === 1) {
    const ref = args.positional[0];
    message = getCommitMessage(ref);
    if (!message) {
      process.stderr.write(`smell-cli: could not read commit message for ref: ${ref}
`);
      process.exit(2);
    }
    inputs = getCommitInputs(ref);
  } else {
    usage();
    process.exit(2);
  }
  const opts = {
    message,
    inputs,
    thresholdFiles: args.flags.thresholdFiles ?? 5,
    thresholdLoc: args.flags.thresholdLoc ?? 100,
    thresholdTopLevelDirs: args.flags.thresholdTopLevelDirs ?? 5
  };
  const { warnings } = await runSmellChecks(opts);
  if (args.flags.json) {
    process.stdout.write(JSON.stringify({
      mode: inputs.mode,
      ref: inputs.ref ?? null,
      warning_count: warnings.length,
      warnings
    }, null, 2) + "\n");
  } else if (warnings.length === 0) {
    process.stdout.write("OK \u2014 no smells detected.\n");
  } else {
    process.stdout.write(`${warnings.length} smell${warnings.length === 1 ? "" : "s"} detected:

`);
    for (let i = 0; i < warnings.length; i++) {
      process.stdout.write(fmtWarning(warnings[i], i) + "\n\n");
    }
  }
  process.exit(warnings.length > 255 ? 255 : warnings.length);
}
main().catch((err) => {
  process.stderr.write(`smell-cli: ${err.message}
`);
  process.exit(1);
});
