import { describe, expect, it } from "vitest";
import { formatImageGenerationError } from "./_core/imageGeneration";

describe("image generation errors", () => {
  it("explains exhausted image-service usage without exposing upstream noise", () => {
    expect(formatImageGenerationError(400, "Bad Request", '{"message":"your account has hit a usage exhausted"}')).toContain("No image was created");
  });

  it("keeps useful status details for unrelated failures", () => {
    expect(formatImageGenerationError(503, "Service Unavailable", "temporary outage")).toBe("Image generation request failed (503 Service Unavailable): temporary outage");
  });
});
