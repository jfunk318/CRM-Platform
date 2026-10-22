import { describe, expect, it } from "vitest";
import { cleanFileName, fileHeaders, isImage, uploadProblem } from "./types";

describe("uploadProblem", () => {
  it("accepts artwork, proof and embroidery files", () => {
    for (const n of ["logo.png", "LOGO.AI", "proof.pdf", "design.eps", "left-chest.dst", "art.svg", "files.zip"]) {
      expect(uploadProblem(n, 1000)).toBeNull();
    }
  });
  it("rejects empty, oversized and unknown files", () => {
    expect(uploadProblem("a.png", 0)).toMatch(/empty/);
    expect(uploadProblem("a.png", 60 * 1024 * 1024)).toMatch(/larger than 50 MB/);
    expect(uploadProblem("run.exe", 10)).toMatch(/isn't accepted/);
    expect(uploadProblem("page.html", 10)).toMatch(/isn't accepted/);
    expect(uploadProblem("noextension", 10)).toMatch(/isn't accepted/);
  });
});

describe("cleanFileName", () => {
  it("drops paths, control characters and quotes", () => {
    expect(cleanFileName("C:\\Users\\pat\\logo.png")).toBe("logo.png");
    expect(cleanFileName("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(cleanFileName('bad"\u0007name.pdf')).toBe("badname.pdf");
    expect(cleanFileName("")).toBe("file");
  });
});

describe("fileHeaders", () => {
  it("shows images and PDFs inline and downloads everything else", () => {
    expect(fileHeaders("proof.png", 10)["Content-Disposition"]).toMatch(/^inline/);
    expect(fileHeaders("proof.pdf", 10)["Content-Disposition"]).toMatch(/^inline/);
    expect(fileHeaders("logo.svg", 10)["Content-Disposition"]).toMatch(/^attachment/);
    expect(fileHeaders("art.ai", 10)["Content-Disposition"]).toMatch(/^attachment/);
    expect(fileHeaders("proof.png", 10, true)["Content-Disposition"]).toMatch(/^attachment/);
  });
  it("never lets a served file run anything", () => {
    const h = fileHeaders("logo.svg", 10);
    expect(h["Content-Security-Policy"]).toMatch(/sandbox/);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Content-Type"]).toBe("image/svg+xml");
  });
  it("encodes unusual filenames", () => {
    expect(fileHeaders("Logo – final.png", 10)["Content-Disposition"]).toContain("Logo%20%E2%80%93%20final.png");
  });
});

describe("isImage", () => {
  it("knows which files can be previewed", () => {
    expect(isImage("a.JPG")).toBe(true);
    expect(isImage("a.pdf")).toBe(false);
  });
});
