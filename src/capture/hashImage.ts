import crypto from "node:crypto";

export class ImageHasher {
  sha256(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }
}
