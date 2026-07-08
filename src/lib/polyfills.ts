// Defensive polyfill for String.prototype.replaceAll (ES2021) on older
// browser/JS runtimes. transformers.js / Next may call it; guard so we never
// hit "replaceAll is not a function".
const sp = String.prototype as unknown as {
  replaceAll?: (search: string | RegExp, replacement: string) => string;
};
if (typeof sp.replaceAll !== "function") {
  sp.replaceAll = function (
    this: string,
    search: string | RegExp,
    replacement: string
  ) {
    const self = String(this);
    if (search instanceof RegExp) {
      if (!search.flags.includes("g")) {
        throw new TypeError(
          "String.prototype.replaceAll called with a non-global RegExp"
        );
      }
      return self.replace(search, replacement);
    }
    return self.split(String(search)).join(String(replacement));
  };
}

export {};
