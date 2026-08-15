/**
 * Turns a browser file/folder/zip selection into a uniform list of entries.
 * Nothing here touches the network — File objects are handed straight to the
 * parse worker via structured clone.
 */

export const isZip = (file) => /\.zip$/i.test(file.name) || file.type === 'application/zip'

/** From <input type="file" webkitdirectory> or a plain multi-file input. */
export function entriesFromFileList(fileList) {
  return Array.from(fileList).map((file) => ({
    path: file.webkitRelativePath || file.name,
    file,
  }))
}

/**
 * From a drag-and-drop DataTransfer. Handles a dropped folder (recursively),
 * a dropped zip, or a plain set of files.
 * DataTransferItemList must be read synchronously, so entries are captured first.
 */
export async function entriesFromDataTransfer(dataTransfer) {
  const items = Array.from(dataTransfer.items || [])
  const fsEntries = items
    .filter((i) => i.kind === 'file')
    .map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null))
    .filter(Boolean)

  if (!fsEntries.length) {
    return Array.from(dataTransfer.files || []).map((file) => ({ path: file.name, file }))
  }

  const out = []
  for (const entry of fsEntries) await walkEntry(entry, '', out)
  return out
}

async function walkEntry(entry, prefix, out) {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject))
    out.push({ path: prefix + entry.name, file })
    return
  }
  if (!entry.isDirectory) return
  const reader = entry.createReader()
  // readEntries returns at most ~100 at a time; keep reading until empty.
  for (;;) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
    if (!batch.length) break
    for (const child of batch) await walkEntry(child, `${prefix + entry.name}/`, out)
  }
}

/** Split a selection into the zip (if any) and loose entries. */
export function categorise(entries) {
  const zipEntry = entries.find((e) => isZip(e.file))
  if (zipEntry && entries.length === 1) return { mode: 'zip', zipFile: zipEntry.file }
  return { mode: 'files', entries: entries.filter((e) => /\.json$/i.test(e.path)) }
}
