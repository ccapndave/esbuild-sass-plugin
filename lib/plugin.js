"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sassPlugin = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const picomatch_1 = __importDefault(require("picomatch"));
const utils_1 = require("./utils");
const importer_1 = require("./importer");
let pluginIndex = 0;
function sassPlugin(options = {}) {
    if (!options.basedir) {
        options.basedir = process.cwd();
    }
    if (!options.picomatch) {
        options.picomatch = { unixify: true };
    }
    const sass = (0, utils_1.loadSass)(options);
    const type = typeof options.type === "string" ? options.type : "css";
    const matchers = Array.isArray(options.type)
        && options.type.map(function ([type, pattern]) {
            if (Array.isArray(pattern)) {
                const importerMatcher = (0, picomatch_1.default)("**/" + pattern[0], options.picomatch);
                const pathMatcher = pattern[1] ? (0, picomatch_1.default)("**/" + pattern[1], options.picomatch) : null;
                if (pathMatcher) {
                    return [
                        type, (args) => importerMatcher(args.importer) && pathMatcher((0, path_1.resolve)(args.resolveDir, args.path))
                    ];
                }
                else {
                    return [
                        type, (args) => importerMatcher(args.importer)
                    ];
                }
            }
            else {
                if (pattern) {
                    const pathMatcher = (0, picomatch_1.default)("**/" + pattern, options.picomatch);
                    return [type, (args) => pathMatcher((0, path_1.resolve)(args.resolveDir, args.path))];
                }
                else {
                    return [type, () => true];
                }
            }
        });
    const typeOf = matchers
        ? (args) => {
            for (const [type, isMatch] of matchers)
                if (isMatch(args)) {
                    return type;
                }
            return type;
        }
        : () => type;
    function pathResolve({ resolveDir, path, importer }) {
        return (0, path_1.resolve)(resolveDir || (0, path_1.dirname)(importer), path);
    }
    function requireResolve({ resolveDir, path, importer }) {
        if (!resolveDir) {
            resolveDir = (0, path_1.dirname)(importer);
        }
        const mapper = options.importMapper;
        if (mapper) {
            path = mapper(path);
        }
        const paths = options.includePaths ? [resolveDir, ...options.includePaths] : [resolveDir];
        return require.resolve(path, { paths });
    }
    function readCssFileSync(path) {
        return { css: (0, fs_1.readFileSync)(path, "utf-8"), watchFiles: [path] };
    }
    const importer = (0, importer_1.createSassImporter)(options);
    function renderSync(file) {
        const { css, stats: { includedFiles } } = sass.renderSync({ importer, ...options, file });
        return {
            css: css.toString("utf-8"),
            watchFiles: includedFiles
        };
    }
    const cache = !options.cache
        ? null
        : options.cache instanceof Map
            ? options.cache
            : new Map();
    function collectStats(watchFiles) {
        return Promise.all(watchFiles.map(filename => fs_1.promises.stat(filename)));
    }
    function maxMtimeMs(stats) {
        return stats.reduce((max, { mtimeMs }) => Math.max(max, mtimeMs), 0);
    }
    function useExclude(callback) {
        const exclude = options.exclude;
        if (exclude instanceof RegExp) {
            return (args) => exclude.test(args.path) ? null : callback(args);
        }
        else if (typeof exclude === "function") {
            return (args) => exclude(args) ? null : callback(args);
        }
        else if (typeof exclude === "object") {
            throw new Error("invalid exclude option");
        }
        else {
            return callback;
        }
    }
    const RELATIVE_PATH = /^\.\.?\//;
    const namespace = `sass-plugin-${pluginIndex++}`;
    return {
        name: "sass-plugin",
        setup: function (build) {
            build.onResolve({ filter: /\.(s[ac]ss|css)$/ }, useExclude((args) => {
                if (RELATIVE_PATH.test(args.path)) {
                    return { path: pathResolve(args), namespace, pluginData: args };
                }
                else {
                    return { path: requireResolve(args), namespace, pluginData: args };
                }
            }));
            let cached;
            if (cache) {
                cached = (transform) => async ({ path, pluginData: args }) => {
                    let group = cache.get(args.resolveDir);
                    if (!group) {
                        group = new Map();
                        cache.set(args.resolveDir, group);
                    }
                    try {
                        let cached = group.get(args.path);
                        if (cached) {
                            let watchFiles = cached.result.watchFiles;
                            let stats = await collectStats(watchFiles);
                            for (const { mtimeMs } of stats) {
                                if (mtimeMs > cached.mtimeMs) {
                                    cached.result = await transform(watchFiles[0], cached.type);
                                    cached.mtimeMs = maxMtimeMs(stats);
                                    break;
                                }
                            }
                            return cached.result;
                        }
                        let type = typeOf(args);
                        let result = await transform(path, type);
                        group.set(args.path, {
                            type,
                            mtimeMs: maxMtimeMs(await collectStats(result.watchFiles)),
                            result
                        });
                        return result;
                    }
                    catch (error) {
                        group.delete(args.path);
                        throw error;
                    }
                };
            }
            else {
                cached = (transform) => ({ path, pluginData: args }) => {
                    return transform(path, typeOf(args));
                };
            }
            const lastWatchFiles = build.initialOptions.watch ? {} : null;
            async function transform(path, type) {
                var _a;
                try {
                    let { css, watchFiles } = path.endsWith(".css") ? readCssFileSync(path) : renderSync(path);
                    watchFiles = [...watchFiles];
                    if (lastWatchFiles) {
                        lastWatchFiles[path] = watchFiles;
                    }
                    if (options.transform) {
                        const out = await options.transform(css, (0, path_1.dirname)(path), path);
                        if (typeof out !== "string") {
                            return {
                                contents: out.contents,
                                loader: out.loader,
                                resolveDir: (0, path_1.dirname)(path),
                                watchFiles
                            };
                        }
                        else {
                            css = out;
                        }
                    }
                    return type === "css" ? {
                        contents: css,
                        loader: "css",
                        resolveDir: (0, path_1.dirname)(path),
                        watchFiles
                    } : {
                        contents: (0, utils_1.makeModule)(css, type),
                        loader: "js",
                        resolveDir: (0, path_1.dirname)(path),
                        watchFiles
                    };
                }
                catch (err) {
                    return {
                        errors: [{ text: err.message }],
                        watchFiles: (_a = lastWatchFiles === null || lastWatchFiles === void 0 ? void 0 : lastWatchFiles[path]) !== null && _a !== void 0 ? _a : [path]
                    };
                }
            }
            build.onLoad({ filter: /./, namespace }, cached(transform));
        }
    };
}
exports.sassPlugin = sassPlugin;
//# sourceMappingURL=plugin.js.map