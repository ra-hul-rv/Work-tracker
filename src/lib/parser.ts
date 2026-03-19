type ParsedDetails = {
  customerName: string;
  contact: string;
  location: string;
  brand: string;
};

const clean = (value: string) => value.trim().replace(/\s+/g, " ");

export const parseWorkDetails = (raw: string): ParsedDetails => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => clean(line))
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { customerName: "", contact: "", location: "", brand: "" };
  }

  const firstLine = lines[0];
  const lastLine = lines.length > 1 ? lines[lines.length - 1] : "";
  const middle = lines.slice(1, Math.max(1, lines.length - 1));

  let customerName = "";
  let contact = "";

  const namePhoneMatch = firstLine.match(/^(.*?)\s*(?:::|:|--?|\|)\s*([+]?\d[\d\s-]{6,})$/);

  if (namePhoneMatch && namePhoneMatch[1] && namePhoneMatch[2]) {
    customerName = clean(namePhoneMatch[1]);
    contact = clean(namePhoneMatch[2]).replace(/\s+/g, "");
  } else {
    customerName = firstLine;
    const digits = firstLine.match(/([+]?\d[\d\s-]{6,})/);
    if (digits) {
      contact = digits[1].replace(/\s+/g, "");
      customerName = clean(firstLine.replace(digits[1], ""));
    }
  }

  const location = middle.join(" ");
  const brand = lastLine;

  return {
    customerName,
    contact,
    location,
    brand,
  };
};
