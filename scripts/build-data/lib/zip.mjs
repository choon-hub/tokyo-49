import { inflateRawSync } from "node:zlib";

// 依存を増やさないための最小限の zip リーダー。
// セントラルディレクトリを読み、無圧縮(0)と deflate(8) の項目だけを扱う（zip64 と暗号化は非対応）。

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/**
 * @param {Buffer} buffer zip ファイル全体
 * @returns {{ name: string, read: () => Buffer }[]}
 */
export function readZipEntries(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip の終端レコードが見つかりません");

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error("zip のセントラルディレクトリが壊れています");
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const rawName = buffer.subarray(offset + 46, offset + 46 + nameLength);
    // bit 11 が立っていれば UTF-8。立っていない日本語名は Shift_JIS とみなす。
    const name = new TextDecoder(flags & 0x800 ? "utf-8" : "shift_jis").decode(
      rawName,
    );
    entries.push({
      name,
      read() {
        if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
          throw new Error(`zip のローカルヘッダが壊れています: ${name}`);
        }
        const start =
          localOffset +
          30 +
          buffer.readUInt16LE(localOffset + 26) +
          buffer.readUInt16LE(localOffset + 28);
        const data = buffer.subarray(start, start + compressedSize);
        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data);
        throw new Error(`未対応の圧縮方式です (${method}): ${name}`);
      },
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
