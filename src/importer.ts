import {SassPluginOptions} from "./index";
import {createImporter} from "sass-extended-importer";
import {Importer} from "sass";

export function createSassImporter({basedir = process.cwd(), importMapper}: SassPluginOptions): Importer {

    const importer: Importer = createImporter({cwd: basedir});

    if (importMapper) {
        return function (url, prev, done) {
            return importer.call(this, importMapper(url), prev, done);
        };
    } else {
        return importer;
    }
}
