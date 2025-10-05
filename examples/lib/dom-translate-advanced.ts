export type TokenMap = Record<
  string,
  { tag: string; attrs: Array<[string, string]> }
>;

const PRESERVE_TAGS = new Set([
  "A",
  "EM",
  "STRONG",
  "CODE",
  "SPAN",
  "SUP",
  "SUB",
  "MARK",
]);
const BLOCK_TAGS = new Set([
  "P",
  "LI",
  "DT",
  "DD",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "CAPTION",
  "FIGCAPTION",
  "TD",
  "TH",
  "PRE",
  "DIV",
]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "MATH"]);

export interface BlockPayload {
  el: Element;
  originalHTML: string;
  segment: string;
  tokenMap: TokenMap;
}

export function collectBlocks(root: HTMLElement): BlockPayload[] {
  const blocks: BlockPayload[] = [];
  const elements = root.querySelectorAll<HTMLElement>(
    Array.from(BLOCK_TAGS).join(",")
  );

  elements.forEach((el) => {
    if (!el.innerText.trim()) return;
    if (el.closest("[aria-hidden='true'], [hidden]")) return;
    const { text, tokenMap } = serializeWithPlaceholders(el);
    if (!text.trim()) return;
    blocks.push({ el, originalHTML: el.innerHTML, segment: text, tokenMap });
  });

  return blocks;
}

export function serializeWithPlaceholders(el: Element): {
  text: string;
  tokenMap: TokenMap;
} {
  let counter = 0;
  const tokenMap: TokenMap = {};
  let output = "";

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      output += node.nodeValue ?? "";
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (SKIP_TAGS.has(element.tagName)) return;

    if (PRESERVE_TAGS.has(element.tagName)) {
      const tokenId = `t${counter++}`;
      tokenMap[tokenId] = {
        tag: element.tagName.toLowerCase(),
        attrs: Array.from(element.attributes).map((attr) => [
          attr.name,
          attr.value,
        ]),
      };
      output += `[[${tokenId}]]`;
      Array.from(element.childNodes).forEach((child) => walk(child));
      output += `[[/${tokenId}]]`;
      return;
    }

    if (element.tagName === "BR") {
      output += "\n";
      return;
    }

    Array.from(element.childNodes).forEach((child) => walk(child));
  };

  Array.from(el.childNodes).forEach((child) => walk(child));
  return { text: output, tokenMap };
}

export function reconstructHTMLFromTranslation(
  target: Element,
  translated: string,
  tokenMap: TokenMap
) {
  const fragment = document.createDocumentFragment();
  const stack: Element[] = [];
  let cursor: Node = fragment;
  let lastIndex = 0;
  const tokenRegex = /\[\[(\/?)t(\d+)]]/g;

  const appendText = (value: string) => {
    if (!value) return;
    const text = document.createTextNode(value);
    (cursor as Element | DocumentFragment).appendChild(text);
  };

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(translated)) !== null) {
    appendText(translated.slice(lastIndex, match.index));
    lastIndex = tokenRegex.lastIndex;

    const isClosing = match[1] === "/";
    const key = `t${match[2]}`;
    const meta = tokenMap[key];
    if (!meta) {
      appendText(match[0]);
      continue;
    }

    if (!isClosing) {
      const element = document.createElement(meta.tag);
      for (const [attr, value] of meta.attrs) {
        try {
          element.setAttribute(attr, value);
        } catch (error) {
          console.warn("Failed to restore attribute", attr, error);
        }
      }
      (cursor as Element | DocumentFragment).appendChild(element);
      stack.push(element);
      cursor = element;
    } else {
      stack.pop();
      cursor = stack[stack.length - 1] ?? fragment;
    }
  }

  appendText(translated.slice(lastIndex));
  (target as HTMLElement).replaceChildren(fragment);
}
