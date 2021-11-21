import {SassPluginOptions} from "./index";
import {createImporter} from "sass-extended-importer";
import {Importer} from "sass";

export function createSassImporter({basedir = process.cwd(), importMapper, importer}: SassPluginOptions): Importer[] {

    if (typeof importer === "string") {
        const txt = String(importer);
        let args = txt.substring(txt.indexOf("{") + 1, txt.lastIndexOf("}")).trim();
        importer = new Function("url", "prev", args) as Importer;
    }

    const importers: Importer[] = Array.isArray(importer) ? importer : importer ? [importer] : [];

    const extendedImporter: Importer = createImporter({cwd: basedir});
    if (importMapper) {
        importers.push(function (url, prev, done) {
            return extendedImporter.call(this, importMapper(url), prev, done);
        });
    } else {
        importers.push(extendedImporter);
    }

    return importers;
}
