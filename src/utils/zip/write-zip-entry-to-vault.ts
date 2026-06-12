import { detectFileFormat } from "../file-utils";
import { BinaryVaultTarget, BinaryWriteResult, ZipEntryHandle } from "./types";

export async function writeZipEntryToVault(
    entry: ZipEntryHandle,
    targetPath:
        | string
        | ((result: BinaryWriteResult) => Promise<string> | string),
    vault: BinaryVaultTarget
): Promise<BinaryWriteResult & { targetPath: string }>;
export async function writeZipEntryToVault(
    entry: ZipEntryHandle,
    targetPath: (
        result: BinaryWriteResult
    ) => Promise<string | null> | string | null,
    vault: BinaryVaultTarget
): Promise<BinaryWriteResult & { targetPath: string | null }>;
export async function writeZipEntryToVault(
    entry: ZipEntryHandle,
    targetPath:
        | string
        | ((
              result: BinaryWriteResult
          ) => Promise<string | null> | string | null),
    vault: BinaryVaultTarget
): Promise<BinaryWriteResult & { targetPath: string | null }> {
    let bytes: Uint8Array | null = await entry.readBytes();

    const detected = detectFileFormat(bytes);

    const result: BinaryWriteResult = {
        byteLength: bytes.byteLength,
        detectedMimeType: detected.mimeType ?? undefined,
        detectedExtension: detected.extension ?? undefined,
    };

    const resolvedTargetPath =
        typeof targetPath === "function"
            ? await targetPath(result)
            : targetPath;

    // A null target path cancels the write (e.g. voice recordings detected
    // after format sniffing) — the caller still gets the detection result.
    if (resolvedTargetPath === null) {
        bytes = null;
        return {
            ...result,
            targetPath: null,
        };
    }

    await vault.adapter.writeBinary(
        resolvedTargetPath,
        bytes.buffer as ArrayBuffer
    );

    bytes = null;
    return {
        ...result,
        targetPath: resolvedTargetPath,
    };
}
