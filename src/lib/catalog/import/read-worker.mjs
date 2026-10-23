// Unzips and parses a supplier CSV off the main thread, so a big catalog
// file doesn't hold up the web server. Plain JavaScript: it's started as a
// worker thread by path (see readCsvRows in sanmar.ts), outside the bundle.
//
// In:  workerData { bytes: Uint8Array, fileName, columns: string[] }
// Out: { header: string[] }, then { rows: string[][] } batches (only the
//      requested columns, in that order), then { done: true } or { error }.
//      Waits for a "more" message whenever MAX_IN_FLIGHT batches are unread.
import { parentPort, workerData } from "node:worker_threads";
import { parse } from "csv-parse";
import { Unzip, UnzipInflate } from "fflate";

const BATCH = 250;
const MAX_IN_FLIGHT = 16;
const { bytes, fileName, columns } = workerData;

let inFlight = 0;
let credit = null;
parentPort.on("message", (m) => {
  if (m !== "more") return;
  inFlight--;
  credit?.();
  credit = null;
});
// A macrotask turn lets the parser emit what it has read; then wait if the reader is behind.
const waitForReader = async () => {
  await new Promise((r) => setImmediate(r));
  if (inFlight >= MAX_IN_FLIGHT) await new Promise((r) => (credit = r));
};

const parser = parse({ bom: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true });
let index = null;
let batch = [];
const flush = () => {
  if (!batch.length) return;
  inFlight++;
  parentPort.postMessage({ rows: batch });
  batch = [];
};
parser.on("readable", () => {
  let rec;
  while ((rec = parser.read()) !== null) {
    if (!index) {
      const header = rec.map((h) => String(h).trim());
      parentPort.postMessage({ header });
      index = columns.map((c) => header.indexOf(c));
      continue;
    }
    batch.push(index.map((i) => (i < 0 ? "" : (rec[i] ?? ""))));
    if (batch.length >= BATCH) flush();
  }
});
const ended = new Promise((resolve, reject) => {
  parser.on("end", resolve);
  parser.on("error", reject);
});

async function run() {
  const zip = /\.zip$/i.test(fileName) || (bytes[0] === 0x50 && bytes[1] === 0x4b);
  if (zip) {
    let found = false;
    let unzipError = null;
    const unzip = new Unzip((file) => {
      // The first CSV inside is the data; any other file is skipped.
      if (found || !/\.csv$/i.test(file.name)) return;
      found = true;
      file.ondata = (err, chunk, final) => {
        if (err) unzipError = `Couldn't unzip ${file.name}: ${err.message}`;
        else parser.write(Buffer.from(chunk));
        if (final) parser.end();
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    const SLICE = 1 << 16;
    for (let i = 0; i < bytes.length; i += SLICE) {
      unzip.push(bytes.subarray(i, i + SLICE), i + SLICE >= bytes.length);
      if (unzipError) throw new Error(unzipError);
      await waitForReader();
    }
    if (!found) throw new Error("There's no CSV file inside that zip");
  } else {
    const SLICE = 1 << 20;
    for (let i = 0; i < bytes.length; i += SLICE) {
      parser.write(Buffer.from(bytes.subarray(i, i + SLICE)));
      await waitForReader();
    }
    parser.end();
  }
  await ended;
  flush();
  parentPort.postMessage({ done: true });
}

run().catch((e) => parentPort.postMessage({ error: e instanceof Error ? e.message : String(e) }));
