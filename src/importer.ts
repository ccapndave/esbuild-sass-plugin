import {SassPluginOptions} from "./index";
import {createImporter} from "sass-extended-importer";
import {Importer} from "sass";

export function createSassImporter({basedir = process.cwd(), importMapper, importer}: SassPluginOptions): Importer[] {

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
