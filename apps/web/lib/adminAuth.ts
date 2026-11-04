import { NextRequest } from "next/server";
import crypto from "crypto";

/**
 * Validates whether the incoming request is authorized for admin access.
 * Compares bearer token or x-admin-token against the ADMIN_SECRET environment variable.
 * Hashes both values with SHA-256 before timingSafeEqual to avoid leaking secret length.
 */
export function verifyAdminRequest(req: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || adminSecret.trim() === "") {
    // Fail secure: reject all admin actions if no secret is configured
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const adminTokenHeader = req.headers.get("x-admin-token");

  let providedToken: string | null = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    providedToken = authHeader.slice(7).trim();
  } else if (adminTokenHeader) {
    providedToken = adminTokenHeader.trim();
  }

  if (!providedToken) {
    return false;
  }

  try {
    const secretHash = crypto.createHash("sha256").update(adminSecret).digest();
    const tokenHash = crypto.createHash("sha256").update(providedToken).digest();

    return crypto.timingSafeEqual(secretHash, tokenHash);
  } catch {
    return false;
  }
}
