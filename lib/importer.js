"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSassImporter = void 0;
const sass_extended_importer_1 = require("sass-extended-importer");
function createSassImporter({ basedir = process.cwd(), importMapper }) {
    const importer = (0, sass_extended_importer_1.createImporter)({ cwd: basedir });
    if (importMapper) {
        return function (url, prev, done) {
            return importer.call(this, importMapper(url), prev, done);
        };
    }
    else {
        return importer;
    }
}
exports.createSassImporter = createSassImporter;
//# sourceMappingURL=importer.js.map