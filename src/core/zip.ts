/**
 * Pure TypeScript, zero-dependency ZIP archive encoder and decoder.
 * Implements the standard PKZIP format with uncompressed storage (Store method).
 * Universal, lossless, offline-first, and fully compatible with OS unzippers.
 */

// CRC-32 table generator
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[i] = c
}

export function computeCRC32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipFileInput {
  name: string
  content: Uint8Array | string
}

/**
 * Creates a standard uncompressed PKZIP file from an array of files.
 */
export function createZipArchive(files: ZipFileInput[]): Uint8Array {
  const encoder = new TextEncoder()
  const localHeaderChunks: Uint8Array[] = []
  const centralDirChunks: Uint8Array[] = []

  let offset = 0

  for (const file of files) {
    const filenameBytes = encoder.encode(file.name)
    const contentBytes =
      typeof file.content === 'string' ? encoder.encode(file.content) : file.content
    const crc = computeCRC32(contentBytes)
    const size = contentBytes.length

    // DOS Time / Date (defaults to constant for deterministic export)
    const dosTime = (12 << 11) | (0 << 5) | (0 >> 1)
    const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1

    // 1. Local File Header (30 bytes + name + content)
    const localHeader = new Uint8Array(30 + filenameBytes.length + size)
    const lView = new DataView(localHeader.buffer)

    lView.setUint32(0, 0x04034b50, true) // Signature
    lView.setUint16(4, 20, true) // Version needed
    lView.setUint16(6, 0x0800, true) // UTF-8 filename flag
    lView.setUint16(8, 0, true) // Store method (0)
    lView.setUint16(10, dosTime, true)
    lView.setUint16(12, dosDate, true)
    lView.setUint32(14, crc, true)
    lView.setUint32(18, size, true) // Compressed size
    lView.setUint32(22, size, true) // Uncompressed size
    lView.setUint16(26, filenameBytes.length, true)
    lView.setUint16(28, 0, true) // Extra field length

    localHeader.set(filenameBytes, 30)
    localHeader.set(contentBytes, 30 + filenameBytes.length)

    localHeaderChunks.push(localHeader)

    // 2. Central Directory Header (46 bytes + name)
    const cdHeader = new Uint8Array(46 + filenameBytes.length)
    const cdView = new DataView(cdHeader.buffer)

    cdView.setUint32(0, 0x02014b50, true) // Central dir signature
    cdView.setUint16(4, 20, true) // Version made by
    cdView.setUint16(6, 20, true) // Version needed
    cdView.setUint16(8, 0x0800, true) // UTF-8 filename flag
    cdView.setUint16(10, 0, true) // Store method
    cdView.setUint16(12, dosTime, true)
    cdView.setUint16(14, dosDate, true)
    cdView.setUint32(16, crc, true)
    cdView.setUint32(20, size, true)
    cdView.setUint32(24, size, true)
    cdView.setUint16(28, filenameBytes.length, true)
    cdView.setUint16(30, 0, true) // Extra field length
    cdView.setUint16(32, 0, true) // Comment length
    cdView.setUint16(34, 0, true) // Disk number
    cdView.setUint16(36, 0, true) // Internal attrs
    cdView.setUint32(38, 0, true) // External attrs
    cdView.setUint32(42, offset, true) // Relative offset of local header

    cdHeader.set(filenameBytes, 46)
    centralDirChunks.push(cdHeader)

    offset += localHeader.length
  }

  // 3. End of Central Directory Record (22 bytes)
  const cdOffset = offset
  let cdSize = 0
  for (const cd of centralDirChunks) {
    cdSize += cd.length
  }

  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true) // EOCD signature
  eocdView.setUint16(4, 0, true)
  eocdView.setUint16(6, 0, true)
  eocdView.setUint16(8, files.length, true)
  eocdView.setUint16(10, files.length, true)
  eocdView.setUint32(12, cdSize, true)
  eocdView.setUint32(16, cdOffset, true)
  eocdView.setUint16(20, 0, true)

  // Merge all chunks
  const totalLength = cdOffset + cdSize + 22
  const zip = new Uint8Array(totalLength)

  let cursor = 0
  for (const chunk of localHeaderChunks) {
    zip.set(chunk, cursor)
    cursor += chunk.length
  }
  for (const chunk of centralDirChunks) {
    zip.set(chunk, cursor)
    cursor += chunk.length
  }
  zip.set(eocd, cursor)

  return zip
}

export interface ExtractedZipFile {
  name: string
  content: Uint8Array
  text: () => string
}

/**
 * Parses and extracts files from a PKZIP archive.
 */
export function readZipArchive(data: Uint8Array): ExtractedZipFile[] {
  const decoder = new TextDecoder()
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const files: ExtractedZipFile[] = []

  // 1. Locate End of Central Directory (search from end)
  let eocdOffset = -1
  for (let i = data.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP file: End of Central Directory record not found')
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const cdOffset = view.getUint32(eocdOffset + 16, true)

  if (totalEntries > 5000) {
    throw new Error('ZIP archive exceeds maximum allowed entry count')
  }

  let cursor = cdOffset
  for (let i = 0; i < totalEntries; i++) {
    if (cursor + 46 > data.length) break
    const cdSig = view.getUint32(cursor, true)
    if (cdSig !== 0x02014b50) break

    const nameLen = view.getUint16(cursor + 28, true)
    const extraLen = view.getUint16(cursor + 30, true)
    const commentLen = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)

    if (cursor + 46 + nameLen > data.length) {
      throw new Error('Corrupted ZIP entry header')
    }

    const nameBytes = data.subarray(cursor + 46, cursor + 46 + nameLen)
    const filename = decoder.decode(nameBytes)

    // Path traversal & null-byte guard
    if (
      filename.includes('\0') ||
      filename.startsWith('/') ||
      filename.startsWith('\\') ||
      filename.split(/[/\\]/).includes('..')
    ) {
      throw new Error(`Unsafe ZIP entry path rejected: ${filename}`)
    }

    // Read file data from local header
    if (localOffset + 30 <= data.length) {
      const lSig = view.getUint32(localOffset, true)
      if (lSig === 0x04034b50) {
        const compMethod = view.getUint16(localOffset + 8, true)
        if (compMethod !== 0) {
          throw new Error(`Unsupported synchronous compression method (${compMethod}) for ${filename}; use readZipArchiveAsync`)
        }
        const lNameLen = view.getUint16(localOffset + 26, true)
        const lExtraLen = view.getUint16(localOffset + 28, true)
        const compSize = view.getUint32(localOffset + 18, true)
        const dataStart = localOffset + 30 + lNameLen + lExtraLen
        if (dataStart + compSize > data.length) {
          throw new Error(`Truncated ZIP entry data for ${filename}`)
        }
        const fileBytes = data.subarray(dataStart, dataStart + compSize)

        files.push({
          name: filename,
          content: fileBytes,
          text: () => decoder.decode(fileBytes),
        })
      }
    }

    cursor += 46 + nameLen + extraLen + commentLen
  }

  return files
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw')
    const writer = ds.writable.getWriter()
    writer.write(new Uint8Array(compressed))
    writer.close()
    const buf = await new Response(ds.readable).arrayBuffer()
    return new Uint8Array(buf)
  }
  // Node.js fallback
  const zlib = await import('zlib')
  return new Uint8Array(zlib.inflateRawSync(compressed))
}

export const MAX_ZIP_ENTRIES = 2000
export const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 25 * 1024 * 1024
export const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
export const MAX_ZIP_COMPRESSION_RATIO = 50

/**
 * Async ZIP reader supporting both Store (method 0) and Deflate (method 8),
 * with zip-bomb limits on entry count, per-entry size, total inflated bytes, and ratio.
 */
export async function readZipArchiveAsync(data: Uint8Array): Promise<ExtractedZipFile[]> {
  const decoder = new TextDecoder()
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const files: ExtractedZipFile[] = []

  let eocdOffset = -1
  for (let i = data.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP file: End of Central Directory record not found')
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const cdOffset = view.getUint32(eocdOffset + 16, true)
  if (totalEntries > MAX_ZIP_ENTRIES) {
    throw new Error(`ZIP archive exceeds maximum allowed entry count (${MAX_ZIP_ENTRIES})`)
  }

  let totalUncompressedBytes = 0
  let cursor = cdOffset
  for (let i = 0; i < totalEntries; i++) {
    if (cursor + 46 > data.length) break
    const cdSig = view.getUint32(cursor, true)
    if (cdSig !== 0x02014b50) break

    const nameLen = view.getUint16(cursor + 28, true)
    const extraLen = view.getUint16(cursor + 30, true)
    const commentLen = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const cdCompSize = view.getUint32(cursor + 20, true)
    const cdUncompSize = view.getUint32(cursor + 24, true)

    if (cursor + 46 + nameLen > data.length) {
      throw new Error('Corrupted ZIP entry header')
    }

    const filename = decoder.decode(data.subarray(cursor + 46, cursor + 46 + nameLen))
    if (
      filename.includes('\0') ||
      filename.startsWith('/') ||
      filename.startsWith('\\') ||
      filename.split(/[/\\]/).includes('..')
    ) {
      throw new Error(`Unsafe ZIP entry path rejected: ${filename}`)
    }

    if (cdUncompSize > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
      throw new Error(`ZIP entry ${filename} exceeds 25 MB limit`)
    }

    if (localOffset + 30 <= data.length && view.getUint32(localOffset, true) === 0x04034b50) {
      const compMethod = view.getUint16(localOffset + 8, true)
      const lNameLen = view.getUint16(localOffset + 26, true)
      const lExtraLen = view.getUint16(localOffset + 28, true)
      const localCompSize = view.getUint32(localOffset + 18, true)
      const compSize = localCompSize > 0 ? localCompSize : cdCompSize
      const dataStart = localOffset + 30 + lNameLen + lExtraLen

      if (dataStart + compSize > data.length) {
        throw new Error(`Truncated ZIP entry data for ${filename}`)
      }

      const rawBytes = data.subarray(dataStart, dataStart + compSize)
      let fileBytes: Uint8Array
      if (compMethod === 0) {
        fileBytes = rawBytes
      } else if (compMethod === 8) {
        fileBytes = await inflateRawBytes(rawBytes)
      } else {
        throw new Error(`Unsupported ZIP compression method (${compMethod}) for ${filename}`)
      }

      if (fileBytes.length > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
        throw new Error(`ZIP entry ${filename} inflated beyond 25 MB limit`)
      }

      if (compMethod === 8 && fileBytes.length > Math.max(4096, rawBytes.length * MAX_ZIP_COMPRESSION_RATIO)) {
        throw new Error(`Suspicious compression ratio (zip bomb guard) for ${filename}`)
      }

      totalUncompressedBytes += fileBytes.length
      if (totalUncompressedBytes > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES) {
        throw new Error('ZIP archive exceeds 100 MB total uncompressed limit')
      }

      files.push({
        name: filename,
        content: fileBytes,
        text: () => decoder.decode(fileBytes),
      })
    }

    cursor += 46 + nameLen + extraLen + commentLen
  }

  return files
}
