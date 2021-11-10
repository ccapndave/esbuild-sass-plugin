"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sassPlugin = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const utils_1 = require("./utils");
const useSass_1 = require("./useSass");
let pluginIndex = 0;
function sassPlugin(options = {}) {
    var _a;
    if (!options.basedir) {
        options.basedir = process.cwd();
    }
    const type = (_a = options.type) !== null && _a !== void 0 ? _a : "css";
    if (options.picomatch || options.exclude || typeof type !== "string") {
        console.log("The type array, exclude and picomatch options are no longer supported, please refer to the README for alternatives.");
    }
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
    const renderAsync = (0, useSass_1.useSass)(options);
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
    const RELATIVE_PATH = /^\.\.?\//;
    const namespace = `sass-plugin-${pluginIndex++}`;
    return {
        name: "sass-plugin",
        setup: function (build) {
            build.onResolve({ filter: /\.(s[ac]ss|css)$/ }, (args) => {
                if (RELATIVE_PATH.test(args.path)) {
                    return { path: pathResolve(args), namespace, pluginData: args };
                }
                else {
                    return { path: requireResolve(args), namespace, pluginData: args };
                }
            });
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
                                    cached.result = await transform(watchFiles[0]);
                                    cached.mtimeMs = maxMtimeMs(stats);
                                    break;
                                }
                            }
                            return cached.result;
                        }
                        let result = await transform(path);
                        group.set(args.path, {
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
                    return transform(path);
                };
            }
            const lastWatchFiles = build.initialOptions.watch ? {} : null;
            async function transform(path) {
                var _a;
                try {
                    let { css, watchFiles } = path.endsWith(".css") ? readCssFileSync(path) : await renderAsync(path);
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