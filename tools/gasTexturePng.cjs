// Minimal PNG codec for the gas asset builder: non-interlaced indexed and RGBA sprites.
const zlib = require('node:zlib');
function decode(bytes) {
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Invalid PNG');
    let header, palette, alpha; const parts = [];
    for (let offset = 8; offset < bytes.length;) {
        const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
        const data = bytes.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') header = data;
        if (type === 'PLTE') palette = data;
        if (type === 'tRNS') alpha = data;
        if (type === 'IDAT') parts.push(data);
        offset += length + 12;
    }
    const width = header.readUInt32BE(0), height = header.readUInt32BE(4), depth = header[8], type = header[9];
    if (header[12] || !(type === 6 && depth === 8 || type === 3 && [1, 2, 4, 8].includes(depth))) throw Error('Unsupported gas PNG format');
    const stride = Math.ceil(width * (type === 6 ? 32 : depth) / 8), bpp = type === 6 ? 4 : 1;
    const raw = zlib.inflateSync(Buffer.concat(parts)), rows = Buffer.alloc(height * stride);
    if (raw.length !== height * (stride + 1)) throw Error('Invalid PNG scanlines');
    const paeth = (a, b, c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        if (filter > 4) throw Error('Unsupported PNG filter');
        for (let x = 0; x < stride; x++) {
            const i = y * stride + x, a = x >= bpp ? rows[i - bpp] : 0, b = y ? rows[i - stride] : 0, c = y && x >= bpp ? rows[i - stride - bpp] : 0;
            rows[i] = raw[y * (stride + 1) + 1 + x] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
        }
    }
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (type === 6) rows.copy(pixels, i, y * stride + x * 4, y * stride + x * 4 + 4);
        else {
            const index = (rows[y * stride + Math.floor(x * depth / 8)] >> (8 - depth - x * depth % 8)) & ((1 << depth) - 1);
            if (!palette || index * 3 + 2 >= palette.length) throw Error('Missing PNG palette entry');
            palette.copy(pixels, i, index * 3, index * 3 + 3); pixels[i + 3] = alpha?.[index] ?? 255;
        }
    }
    return { width, height, pixels };
}
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(name, data) { const type = Buffer.from(name), len = Buffer.alloc(4), crc = Buffer.alloc(4); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data]))); return Buffer.concat([len, type, data, crc]); }
function encode({ width, height, pixels }) {
    const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
    const rows = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) pixels.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
module.exports = { decode, encode };
