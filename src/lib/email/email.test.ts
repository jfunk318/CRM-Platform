import { describe, expect, it } from "vitest";
import { escapeHtml, proofEmail, quoteEmail, staffAlertEmail } from "./templates";

const brand = { name: "Company Name", email: "hello@companyname.com", phone: "603-555-0100" };

describe("email templates", () => {
  it("builds a quote email with the link and total", () => {
    const e = quoteEmail({ brand, customerName: "Pat", ref: "Q-1001", total: "241.92", url: "https://companyname.com/q/abc" });
    expect(e.subject).toBe("Your quote Q-1001 from Company Name");
    expect(e.text).toContain("$241.92");
    expect(e.text).toContain("https://companyname.com/q/abc");
    expect(e.html).toContain('href="https://companyname.com/q/abc"');
  });

  it("escapes everything placed into HTML", () => {
    const e = proofEmail({
      brand: { name: "<b>Shop</b>" },
      customerName: '<script>alert("x")</script>',
      ref: "#1001",
      proofNumber: 2,
      url: 'https://x.com/p/a"onmouseover="alert(1)',
      message: "Line one\nLine <two>",
    });
    expect(e.html).not.toContain("<script>");
    expect(e.html).not.toContain("<b>Shop</b>");
    expect(e.html).not.toContain('a"onmouseover');
    expect(e.html).toContain("Line one<br>Line &lt;two&gt;");
  });

  it("builds staff alerts", () => {
    const e = staffAlertEmail({ brand, heading: "Pat approved quote Q-1001", lines: ["Total $241.92"], url: "https://x/admin/orders/1" });
    expect(e.subject).toBe("Pat approved quote Q-1001");
    expect(e.text).toContain("Open in the back office: https://x/admin/orders/1");
  });

  it("escapes quotes and ampersands", () => {
    expect(escapeHtml(`a & b "c" 'd'`)).toBe("a &amp; b &quot;c&quot; &#39;d&#39;");
  });
});
