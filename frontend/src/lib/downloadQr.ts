/**
 * One-shot QR image download for an arbitrary payload string.
 *
 * Studio keeps a long-lived `QRCodeStyling` instance attached to its preview
 * container. Console (and other table-style views) just need to fire a
 * download on click — no preview needed, no per-row mount cost.
 *
 * This helper:
 *   1. Mounts a `QRCodeStyling` instance into an off-screen DOM node
 *   2. Tells the library to render + download a PNG
 *   3. Removes the off-screen node
 *
 * Returns true on success, false if the library couldn't produce the image
 * (e.g. empty payload, browser blocked the download). Callers can show a
 * toast on `false`.
 */
import QRCodeStyling from "qr-code-styling";

interface DownloadQrOptions {
  payload: string;
  /** Filename without extension. Defaults to `mira-qr`. */
  filename?: string;
  /** Pixel size. Default 512 — big enough for print, still small file. */
  size?: number;
}

export async function downloadQrImage({
  payload,
  filename = "mira-qr",
  size = 512,
}: DownloadQrOptions): Promise<boolean> {
  if (!payload) return false;

  // Off-screen container — never visible, removed after download.
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-9999px";
  host.style.top = "-9999px";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  try {
    const qr = new QRCodeStyling({
      width: size,
      height: size,
      data: payload,
      margin: 8,
    });
    qr.append(host);
    await qr.download({ name: filename, extension: "png" });
    return true;
  } catch {
    return false;
  } finally {
    host.remove();
  }
}
