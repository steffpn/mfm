import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock @aws-sdk/client-s3 ----
const mockSend = vi.fn().mockResolvedValue({});

vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn().mockImplementation((config: unknown) => ({
      send: (...args: unknown[]) => mockSend(...args),
      _config: config,
    })),
    PutObjectCommand: vi.fn().mockImplementation((input: unknown) => ({
      _type: "PutObjectCommand",
      input,
    })),
    GetObjectCommand: vi.fn().mockImplementation((input: unknown) => ({
      _type: "GetObjectCommand",
      input,
    })),
  };
});

// ---- Mock @aws-sdk/s3-request-presigner ----
const mockGetSignedUrl = vi
  .fn()
  .mockResolvedValue("https://presigned-url.example.com/test");

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

describe("R2 Client", () => {
  let uploadToR2: typeof import("../../src/lib/r2.js").uploadToR2;
  let getPresignedUrl: typeof import("../../src/lib/r2.js").getPresignedUrl;

  beforeEach(async () => {
    mockSend.mockReset().mockResolvedValue({});
    mockGetSignedUrl
      .mockReset()
      .mockResolvedValue("https://presigned-url.example.com/test");

    // Set env vars for R2 client initialization
    process.env.SNIPPETS_ENABLED = "true";
    process.env.R2_ACCOUNT_ID = "test-account-id";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_BUCKET_NAME = "test-bucket";

    const mod = await import("../../src/lib/r2.js");
    uploadToR2 = mod.uploadToR2;
    getPresignedUrl = mod.getPresignedUrl;
  });

  it("uploadToR2 calls PutObjectCommand with correct Bucket, Key, Body, ContentType", async () => {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");

    const body = Buffer.from("test audio data");
    await uploadToR2("snippets/1/2026-03-15/42.aac", body, "audio/aac");

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "snippets/1/2026-03-15/42.aac",
      Body: body,
      ContentType: "audio/aac",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("getPresignedUrl calls getSignedUrl with GetObjectCommand and 86400s expiry by default", async () => {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");

    const url = await getPresignedUrl("snippets/1/2026-03-15/42.aac");

    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "snippets/1/2026-03-15/42.aac",
    });
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(), // r2Client
      expect.objectContaining({ _type: "GetObjectCommand" }),
      { expiresIn: 86400 },
    );
    expect(url).toBe("https://presigned-url.example.com/test");
  });

  it("getPresignedUrl accepts custom expiresInSeconds parameter", async () => {
    await getPresignedUrl("snippets/1/2026-03-15/42.aac", 3600);

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 3600 },
    );
  });

  it("R2 client configured with correct endpoint pattern using R2_ACCOUNT_ID", async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: "auto",
        endpoint: "https://test-account-id.r2.cloudflarestorage.com",
      }),
    );
  });
});
