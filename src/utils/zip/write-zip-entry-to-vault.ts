import { detectFileFormat } from "../file-utils";
import { BinaryVaultTarget, BinaryWriteResult, ZipEntryHandle } from "./types";

export async function writeZipEntryToVault(
    entry: ZipEntryHandle,
    targetPath: string | ((result: BinaryWriteResult) => Promise<string> | string),
    vault: BinaryVaultTarget
): Promise<BinaryWriteResult & { targetPath: string }> {
    let bytes: Uint8Array | null = await entry.readBytes();

    const detected = detectFileFormat(bytes);

    const result: BinaryWriteResult = {
        byteLength: bytes.byteLength,
        detectedMimeType: detected.mimeType ?? undefined,
        detectedExtension: detected.extension ?? undefined,
    };

    const resolvedTargetPath = typeof targetPath === "function"
        ? await targetPath(result)
        : targetPath;

    await vault.adapter.writeBinary(resolvedTargetPath, bytes.buffer as ArrayBuffer);

    bytes = null;
    return {
        ...result,
        targetPath: resolvedTargetPath,
    };
}
