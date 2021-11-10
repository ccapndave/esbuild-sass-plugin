"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSassImporter = void 0;
const sass_extended_importer_1 = require("sass-extended-importer");
function createSassImporter({ basedir = process.cwd(), importMapper, importer }) {
    const importers = Array.isArray(importer) ? importer : importer ? [importer] : [];
    const extendedImporter = (0, sass_extended_importer_1.createImporter)({ cwd: basedir });
    if (importMapper) {
        importers.push(function (url, prev, done) {
            return extendedImporter.call(this, importMapper(url), prev, done);
        });
    }
    else {
        importers.push(extendedImporter);
    }
    return importers;
}
exports.createSassImporter = createSassImporter;
//# sourceMappingURL=importer.js.map