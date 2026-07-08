// Defensive polyfill: some runtimes (older Node / browsers) launched to run
// the Next standalone server or the renderer may not implement
// String.prototype.replaceAll (ES2021). transformers.js / Next may call it.
if (typeof String.prototype.replaceAll !== "function") {
  // eslint-disable-next-line no-extend-native
  String.prototype.replaceAll = function (search, replacement) {
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
