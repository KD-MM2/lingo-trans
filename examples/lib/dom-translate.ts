export interface NodeChunk {
  node: Text;
  original: string;
}

export function collectTextNodes(root: HTMLElement): NodeChunk[] {
  const skipTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);
  const result: NodeChunk[] = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !node.nodeValue.trim())
        return NodeFilter.FILTER_REJECT;
      if (parent.closest("[aria-hidden='true'], [hidden]"))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current: Node | null;
  while ((current = walker.nextNode())) {
    result.push({
      node: current as Text,
      original: (current as Text).nodeValue ?? "",
    });
  }

  return result;
}

export function replaceNodes(chunks: NodeChunk[], translations: string[]) {
  chunks.forEach((chunk, index) => {
    const value = translations[index];
    if (value) chunk.node.nodeValue = value;
  });
}

export function undoReplace(chunks: NodeChunk[]) {
  chunks.forEach((chunk) => {
    chunk.node.nodeValue = chunk.original;
  });
}
