const esbuild = require("esbuild");
const {sassPlugin} = require("../../../lib");

esbuild
    .build({
        entryPoints: ["index.js"],
        bundle: true,
        plugins: [
            sassPlugin({
                importer(url) {
                    if (url === "$env") {
                        return {content: `$color: ${"blue"}`}
                    }
                    return null;
                }
            })
        ]
    })
    .then(console.log)
    .catch(console.error);