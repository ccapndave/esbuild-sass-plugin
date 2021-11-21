const {
    Worker, isMainThread, parentPort, workerData, threadId
} = require("worker_threads");

if (isMainThread) {

    const { EventEmitter } = require('events');

    module.exports.useSass = function (options) {

        const WORKER_FREED_EVENT = Symbol();

        const emitter = new EventEmitter();

        const workers = [
            createWorker(),
            createWorker(),
            createWorker(),
            createWorker(),
        ];

        function createWorker() {
            const worker = new Worker(__filename, {workerData: {...options, importer: options.importer?.toString()}});
            worker.on("message", ({css, includedFiles}) => {
                worker.resolve({
                    css: Buffer.from(css).toString(),
                    watchFiles: includedFiles
                });
                workers.push(worker);
                emitter.emit(WORKER_FREED_EVENT);
            });
            worker.on('error', (err) => {
                worker.reject(err);
                workers.push(worker);
                emitter.emit(WORKER_FREED_EVENT);
            });
            return worker;
        }

        const queue = [];

        emitter.on(WORKER_FREED_EVENT, ()=>{
            const resolve = queue.pop();
            if (resolve) {
                resolve();
            }
        });

        return async function renderSync(file) {
            if (workers.length === 0) {
                await new Promise(resolve => queue.push(resolve));
            }
            return new Promise((resolve, reject) => {
                const worker = workers.pop();
                worker.resolve = resolve;
                worker.reject = reject;
                worker.postMessage({file});
            });
        };
    };

} else {

    const {createSassImporter} = require("./importer");
    const {requireModule} = require("./utils");

    const options = workerData;
    const {implementation: module = "sass", includePaths} = options;
    const sass = requireModule(module, includePaths);
    const importer = createSassImporter(options);

    parentPort.on('message', (task) => {
        const { file } = task
        const {
            css,
            stats: {
                includedFiles
            }
        } = sass.renderSync({...options, importer, file});
        parentPort.postMessage({css, includedFiles});
    })
}
