import { DesktopZipArchiveReader, readDesktopZipEntries } from "./desktop-zip-reader";
import { MobileZipArchiveReader, readMobileZipEntries } from "./mobile-zip-reader";
import { ZipArchiveReader, ZipEntryMeta } from "./types";

export * from "./types";
export { buildAttachmentLookupIndex } from "./attachment-lookup-index";
export { writeZipEntryToVault } from "./write-zip-entry-to-vault";

export async function createZipArchiveReader(
    file: File,
    shouldInclude?: (entryName: string, uncompressedSize: number) => boolean
): Promise<ZipArchiveReader> {
    const filePath: string | undefined = (file as any).path;

    if (filePath) {
        const entries = await readDesktopZipEntries(filePath, shouldInclude);
        return new DesktopZipArchiveReader(filePath, entries);
    }

    const mobileEntries = await readMobileZipEntries(file, shouldInclude);
    return new MobileZipArchiveReader(file, mobileEntries);
}

export async function enumerateZipEntries(
    file: File,
    shouldInclude?: (entryName: string, uncompressedSize: number) => boolean
): Promise<ZipEntryMeta[]> {
    const reader = await createZipArchiveReader(file, shouldInclude);
    return reader.listEntries();
}
