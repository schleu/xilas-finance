import { describe, expect, it } from "vitest";
import { NfeParseError, parseSefazHtml, validateAndDetectSefazUrl } from "./parser";

const SAMPLE_SEFAZ_HTML = `
<html><body>
  <div id="u20" class="txtTopo">ASSAI ATACADISTA FORTALEZA</div>
  <div>Emissão: 27/11/2026 14:30:00</div>
  <table>
    <tr id="Item + 1">
      <td>
        <span class="txtTit">SABAO EM PO OMO 1KG</span>
        <span class="Rqtd">Qtde.: 1</span>
        <span class="RUN">UN: KG</span>
        <span class="RvlUnit">Vl. Unit.: 15,90</span>
      </td>
      <td><span class="valor">15,90</span></td>
    </tr>
    <tr id="Item + 2">
      <td>
        <span class="txtTit">BANANA PRATA</span>
        <span class="Rqtd">Qtde.: 2,5</span>
        <span class="RUN">UN: KG</span>
        <span class="RvlUnit">Vl. Unit.: 6,00</span>
      </td>
      <td><span class="valor">15,00</span></td>
    </tr>
  </table>
  <span class="totalNumb txtMax">30,90</span>
</body></html>
`;

describe("SEFAZ CE/BA NFC-e parser (007 / T-05)", () => {
  it("aceita URLs oficiais da SEFAZ-CE e SEFAZ-BA e bloqueia domínios externos (anti-SSRF)", () => {
    expect(validateAndDetectSefazUrl("https://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=123").uf).toBe("CE");
    expect(validateAndDetectSefazUrl("https://nfe.sefaz.ba.gov.br/servicos/nfce/default.aspx?p=123").uf).toBe("BA");

    expect(() => validateAndDetectSefazUrl("http://127.0.0.1/internal")).toThrow(NfeParseError);
    expect(() => validateAndDetectSefazUrl("https://evil.example.com/sefaz")).toThrow(NfeParseError);
  });

  it("extrai mercado, data, total e subitens em centavos inteiros classificando categorias", () => {
    const parsed = parseSefazHtml(SAMPLE_SEFAZ_HTML, "CE");
    expect(parsed.uf).toBe("CE");
    expect(parsed.marketName).toBe("ASSAI ATACADISTA FORTALEZA");
    expect(parsed.issuedDate).toBe("2026-11-27");
    expect(parsed.totalCents).toBe(3090);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toMatchObject({
      description: "SABAO EM PO OMO 1KG",
      item_category: "cleaning",
      quantity: 1,
      unit: "kg",
      unit_price_cents: 1590,
      total_cents: 1590,
    });
    expect(parsed.items[1]).toMatchObject({
      description: "BANANA PRATA",
      item_category: "produce",
      quantity: 2.5,
      unit: "kg",
      unit_price_cents: 600,
      total_cents: 1500,
    });
  });

  it("detecta CAPTCHA sem tentar contornar e retorna erro estruturado", () => {
    const captchaHtml = `<html><body><div class="g-recaptcha" data-sitekey="abc"></div></body></html>`;
    expect(() => parseSefazHtml(captchaHtml, "BA")).toThrow(/CAPTCHA/i);
  });
});
